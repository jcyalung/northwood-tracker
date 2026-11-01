import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { senseisCollection } from "@/lib/senseis";

// Which sensei is using the central account in this browser, picked on
// /sensei after signing in. Cleared on sign in and sign out.
export const SENSEI_COOKIE = "nw_sensei";

export async function currentSensei() {
  const id = (await cookies()).get(SENSEI_COOKIE)?.value;
  if (!id) return null;
  return senseisCollection().findOne(
    { id },
    { projection: { _id: 0, id: 1, first_name: 1, last_name: 1 } },
  );
}

// The name saved with an edit: "Manager", or the sensei's first name.
export async function editedBy(session: Session): Promise<string | undefined> {
  if (session.user.account === "manager") return "Manager";
  return (await currentSensei())?.first_name;
}
