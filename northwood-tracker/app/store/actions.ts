"use server";

import { auth } from "@/auth";
import { db } from "@/lib/mongodb";
import { catalogPrice } from "@/lib/store";
import { studentsCollection } from "@/lib/students";

// A Purchases document (rsrc/SCHEMA.md).
type Purchase = {
  student_id: string;
  date_purchased: Date;
  stars_used: number;
  item_purchased: string;
};

export type RedeemResult =
  { ok: true; stars: number } | { ok: false; error: string };

// Max length for an "Other" item name.
const MAX_ITEM_LENGTH = 80;

// Redeems stars for an item: lowers the student's balance and records the
// purchase. Catalog prices are set here, not trusted from the form; only
// "Other" items use the submitted star count.
export async function redeemStars(input: {
  studentId: string;
  item: string;
  stars: number;
}): Promise<RedeemResult> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };

  const item = input.item?.trim();
  if (!item || item.length > MAX_ITEM_LENGTH) {
    return { ok: false, error: "Enter what they're buying." };
  }
  const cost = catalogPrice(item) ?? input.stars;
  if (!Number.isInteger(cost) || cost < 1) {
    return { ok: false, error: "Stars must be a whole number above 0." };
  }

  // Only lowers the balance if they have enough, so two purchases at once
  // can't overspend.
  const updated = await studentsCollection().findOneAndUpdate(
    { id: input.studentId, stars: { $gte: cost } },
    { $inc: { stars: -cost } },
    { returnDocument: "after", projection: { _id: 0, stars: 1 } },
  );
  if (!updated) {
    const student = await studentsCollection().findOne(
      { id: input.studentId },
      { projection: { _id: 0, stars: 1 } },
    );
    return {
      ok: false,
      error: student
        ? `Not enough stars: they have ${student.stars ?? 0}.`
        : "That student doesn't exist.",
    };
  }

  await db.collection<Purchase>("purchases").insertOne({
    student_id: input.studentId,
    date_purchased: new Date(),
    stars_used: cost,
    item_purchased: item,
  });

  return { ok: true, stars: updated.stars ?? 0 };
}
