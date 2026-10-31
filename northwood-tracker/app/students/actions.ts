"use server";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { auth } from "@/auth";
import { BELT_TYPES } from "@/lib/belts";
import { DEBRIEF_METHODS, MAX_LEVEL, PROGRAMS, TAGS } from "@/lib/options";
import { db } from "@/lib/mongodb";
import {
  getBelts,
  studentsCollection,
  type Activity,
  type Belt,
  type Student,
} from "@/lib/students";

export type NewStudentInput = {
  first_name: string;
  last_name: string;
  parent_email: string;
  // YYYY-MM-DD, from <input type="date">.
  birthday: string;
  program: string;
  belt_id: number;
  belt_level: number;
  belt_type: string;
  debrief_method: string;
  tags: string[];
  notes: string;
};

export type CreateStudentResult =
  { ok: true; student: Student } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Inserts a new student into MongoDB. Server Functions can be called with a
// direct POST, so this checks sign-in and validates everything itself.
export async function createStudent(
  input: NewStudentInput,
): Promise<CreateStudentResult> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };

  const first_name = input.first_name?.trim();
  const last_name = input.last_name?.trim();
  const parent_email = input.parent_email?.trim().toLowerCase();
  if (!first_name || !last_name) {
    return { ok: false, error: "First and last name are required." };
  }
  if (!parent_email || !EMAIL.test(parent_email)) {
    return { ok: false, error: "Enter a valid parent email." };
  }

  const birthday = toSchemaDate(input.birthday);
  if (!birthday) return { ok: false, error: "Enter a valid birthday." };

  const belt = await validBelt(input);
  if ("error" in belt) return { ok: false, error: belt.error };

  if (!PROGRAMS.includes(input.program as never)) {
    return { ok: false, error: "Pick a program." };
  }
  if (input.debrief_method && !DEBRIEF_METHODS.includes(input.debrief_method)) {
    return { ok: false, error: "Pick a debrief method." };
  }
  const tags = [...new Set(input.tags ?? [])];
  if (!tags.every((t) => TAGS.includes(t))) {
    return { ok: false, error: "Pick tags from the list." };
  }

  const collection = studentsCollection();
  const duplicate = await collection.findOne({
    first_name: { $regex: `^${escapeRegex(first_name)}$`, $options: "i" },
    last_name: { $regex: `^${escapeRegex(last_name)}$`, $options: "i" },
    birthday,
  });
  if (duplicate) {
    return {
      ok: false,
      error: `${first_name} ${last_name} with that birthday already exists.`,
    };
  }

  const student: Student = {
    id: randomUUID(),
    first_name,
    last_name,
    parent_email,
    birthday,
    belt,
    // Required by SCHEMA.md; new students start with none.
    stars: 0,
    program: input.program as Student["program"],
    ...(input.debrief_method && { debrief_method: input.debrief_method }),
    ...(tags.length && {
      tags: tags.map((name) => ({ name, expires_at: null })),
    }),
    ...(input.notes?.trim() && { notes: input.notes.trim() }),
  };

  // insertOne adds `_id` to the object it's given, so insert a copy.
  await collection.insertOne({ ...student });
  return { ok: true, student };
}

// Checks a belt choice against the `belts` collection (level within the
// belt's real level count; a type for Bronze and up) and builds it.
async function validBelt(input: {
  belt_id: number;
  belt_level: number;
  belt_type: string;
}): Promise<Belt | { error: string }> {
  const info = (await getBelts()).find((b) => b.belt_id === input.belt_id);
  if (!info) return { error: "Pick a belt." };
  const isJunior = info.levels === null;
  if (
    !isJunior &&
    !(
      Number.isInteger(input.belt_level) &&
      input.belt_level >= 1 &&
      input.belt_level <= (info.levels ?? MAX_LEVEL)
    )
  ) {
    return { error: "Pick a level." };
  }
  if (info.has_type && !BELT_TYPES.includes(input.belt_type as never)) {
    return { error: "Pick a belt type." };
  }
  return {
    belt_id: info.belt_id,
    belt_title: info.title,
    ...(!isJunior && { belt_level: input.belt_level }),
    ...(info.has_type && { belt_type: input.belt_type }),
  };
}

export type StudentEdits = {
  parent_email: string | null;
  belt_id: number;
  belt_level: number;
  belt_type: string;
  program: string;
  tags: string[];
  notes: string;
  // A new star balance; changing it needs `starsPassword`.
  stars?: number;
  starsPassword?: string;
};

// Largest star balance (either way) an edit can set.
const MAX_STARS = 100_000;

// Whether `given` matches STARS_PASSWORD in .env. Compares hashes in constant
// time, so a wrong guess doesn't reveal how close it was.
function starsPasswordMatches(given: string | undefined): boolean {
  const expected = process.env.STARS_PASSWORD;
  if (!expected || !given) return false;
  const hash = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(hash(given), hash(expected));
}

export type UpdateStudentResult =
  { ok: true; student: Student } | { ok: false; error: string };

// Saves edits from the All Students window. Tags keep their expiry; a belt
// or level change starts them on that level's first activity.
export async function updateStudent(
  studentId: string,
  edits: StudentEdits,
): Promise<UpdateStudentResult> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };

  const current = await studentsCollection().findOne(
    { id: studentId },
    { projection: { _id: 0 } },
  );
  if (!current) return { ok: false, error: "That student doesn't exist." };

  const parent_email = edits.parent_email?.trim().toLowerCase() || null;
  if (parent_email && !EMAIL.test(parent_email)) {
    return { ok: false, error: "Enter a valid parent email." };
  }
  const belt = await validBelt(edits);
  if ("error" in belt) return { ok: false, error: belt.error };
  if (!PROGRAMS.includes(edits.program as never)) {
    return { ok: false, error: "Pick a program." };
  }
  const tagNames = [...new Set(edits.tags ?? [])];
  const known = new Set([...TAGS, ...(current.tags ?? []).map((t) => t.name)]);
  if (!tagNames.every((t) => known.has(t))) {
    return { ok: false, error: "Pick tags from the list." };
  }
  // Star changes need the password (checked here, not just in the form).
  const starsChanged =
    edits.stars !== undefined && edits.stars !== (current.stars ?? 0);
  if (starsChanged) {
    if (!Number.isInteger(edits.stars) || Math.abs(edits.stars!) > MAX_STARS) {
      return { ok: false, error: "Stars must be a whole number." };
    }
    if (!process.env.STARS_PASSWORD) {
      return {
        ok: false,
        error: "Editing stars isn't set up (no STARS_PASSWORD in .env).",
      };
    }
    if (!starsPasswordMatches(edits.starsPassword)) {
      // A short pause slows down guessing.
      await new Promise((r) => setTimeout(r, 1000));
      return { ok: false, error: "Wrong password for changing stars." };
    }
  }

  const notes = (edits.notes ?? "").trim();
  if (notes.length > 5000) return { ok: false, error: "Notes are too long." };

  const beltChanged =
    belt.belt_id !== current.belt.belt_id ||
    belt.belt_level !== current.belt.belt_level;
  const firstActivity = beltChanged
    ? ((
        await db.collection<{ activities: Activity[] }>("belt_paths").findOne(
          {
            belt_id: belt.belt_id,
            ...(belt.belt_level !== undefined && {
              belt_level: belt.belt_level,
            }),
          },
          { projection: { _id: 0, activities: 1 } },
        )
      )?.activities[0] ?? null)
    : undefined;

  const set: Record<string, unknown> = {
    ...(starsChanged && { stars: edits.stars }),
    parent_email,
    belt,
    program: edits.program,
    // Kept tags keep their expiry; newly checked ones don't expire.
    tags: tagNames.map(
      (name) =>
        current.tags?.find((t) => t.name === name) ?? {
          name,
          expires_at: null,
        },
    ),
  };
  const unset: Record<string, ""> = { label: "" };
  if (notes) set.notes = notes;
  else unset.notes = "";
  if (firstActivity) set.current_activity = firstActivity;
  else if (firstActivity === null) unset.current_activity = "";

  const student = await studentsCollection().findOneAndUpdate(
    { id: studentId },
    { $set: set, $unset: unset },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  return student
    ? { ok: true, student }
    : { ok: false, error: "That student doesn't exist." };
}

// YYYY-MM-DD -> MM/DD/YYYY (the format in SCHEMA.md), or null if invalid or
// in the future.
function toSchemaDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date > new Date()) return null;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
