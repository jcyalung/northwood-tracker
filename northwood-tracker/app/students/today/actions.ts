"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { capitalize, earnedStars } from "@/lib/belts";
import { editedBy } from "@/lib/current-sensei";
import { db } from "@/lib/mongodb";
import { sessionHours, todayInPacific } from "@/lib/sessions";
import {
  getBelts,
  sessionNotesCollection,
  studentsCollection,
  type Activity,
  type Belt,
  type SessionNote,
} from "@/lib/students";

export type CheckInResult = { ok: true } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

// Checks a student in to an hour today: creates today's Session Note for
// them, which is what Students Today, Schedule, and the Star Store read.
// One check-in per student per day.
export async function checkInStudent(
  studentId: string,
  hour: string,
): Promise<{ ok: true; note: SessionNote } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "You're not signed in." };
  return checkIn(studentId, hour, await editedBy(session));
}

async function checkIn(
  studentId: string,
  hour: string,
  by: string | undefined,
): Promise<{ ok: true; note: SessionNote } | { ok: false; error: string }> {
  const date = todayInPacific();
  if (!sessionHours(date).includes(hour)) {
    return { ok: false, error: `${hour} isn't a check-in hour today.` };
  }
  const student = await studentsCollection().findOne(
    { id: studentId },
    { projection: { _id: 0, first_name: 1, last_name: 1 } },
  );
  if (!student) return { ok: false, error: "That student doesn't exist." };

  const existing = await sessionNotesCollection().findOne(
    { student_id: studentId, session_date: date },
    { projection: { _id: 0, session_hour: 1 } },
  );
  if (existing) {
    return {
      ok: false,
      error: `${student.first_name} is already checked in at ${existing.session_hour}.`,
    };
  }

  // Today's notes start from what their last session said to work on next.
  const last = await sessionNotesCollection().findOne(
    {
      student_id: studentId,
      session_date: { $ne: date },
      next_steps: { $exists: true, $ne: "" },
    },
    { sort: { last_edited: -1 }, projection: { _id: 0, next_steps: 1 } },
  );

  const note: SessionNote & { edited_by?: string } = {
    session_id: randomUUID(),
    session_date: date,
    student_id: studentId,
    session_hour: hour,
    debriefed: false,
    finalized: false,
    last_edited: new Date().toISOString(),
    ...(last?.next_steps && { working_on: last.next_steps }),
    ...(by && { edited_by: by }),
  };
  try {
    await sessionNotesCollection().insertOne({ ...note });
    await addToSession(
      date,
      hour,
      studentId,
      `${student.first_name} ${student.last_name}`,
    );
  } catch (error) {
    // The unique index caught a check-in made at the same moment.
    if ((error as { code?: number }).code === 11000) {
      return {
        ok: false,
        error: `${student.first_name} is already checked in.`,
      };
    }
    throw error;
  }
  return { ok: true, note };
}

// Removes a student's check-in for today, along with any notes written for
// it. Finalized (closed) days can't be changed.
export async function removeCheckIn(studentId: string): Promise<CheckInResult> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };
  return removeOne(studentId);
}

async function removeOne(studentId: string): Promise<CheckInResult> {
  const date = todayInPacific();
  const removed = await sessionNotesCollection().findOneAndDelete(
    { student_id: studentId, session_date: date, finalized: { $ne: true } },
    { projection: { _id: 0, session_hour: 1 } },
  );
  if (!removed) {
    return {
      ok: false,
      error: "That check-in was already removed or is closed.",
    };
  }
  await sessionsCollection().updateOne(
    { date },
    {
      $pull: { [`session.${removed.session_hour}`]: { student_id: studentId } },
    },
  );
  return { ok: true };
}

// The day's Sessions record (rsrc/SCHEMA.md): which students were checked in
// to each hour. Kept alongside each student's Session Note for the day.
type SessionRecord = {
  session_id: string;
  date: string;
  session: Record<string, { student_id: string; student_name: string }[]>;
};
const sessionsCollection = () => db.collection<SessionRecord>("sessions");

// Adds a student to an hour in the day's session, creating the day's record
// the first time someone checks in.
async function addToSession(
  date: string,
  hour: string,
  studentId: string,
  studentName: string,
) {
  await sessionsCollection().updateOne(
    { date },
    {
      $setOnInsert: { session_id: randomUUID(), date },
      $push: {
        [`session.${hour}`]: {
          student_id: studentId,
          student_name: studentName,
        },
      },
    },
    { upsert: true },
  );
}

export type ScheduleChanges = {
  add: { studentId: string; hour: string }[];
  remove: string[];
};

export type SaveScheduleResult =
  | { ok: false; error: string }
  | {
      ok: true;
      // Changes that couldn't be saved, with why.
      failed: { studentId: string; error: string }[];
    };

// Saves a batch of Schedule edits: removals first (so a student can move
// hours), then check-ins. Each change succeeds or fails on its own.
export async function saveSchedule(
  changes: ScheduleChanges,
): Promise<SaveScheduleResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "You're not signed in." };

  const failed: { studentId: string; error: string }[] = [];
  for (const studentId of changes.remove) {
    const result = await removeOne(studentId);
    if (!result.ok) failed.push({ studentId, error: result.error });
  }
  for (const { studentId, hour } of changes.add) {
    const result = await checkIn(studentId, hour, await editedBy(session));
    if (!result.ok) failed.push({ studentId, error: result.error });
  }
  return { ok: true, failed };
}

// ---------------------------------------------------------------------------
// Progress during a session. Every change is one small update to today's
// Session Note or the student, so it's light enough for the Pi.

type NoteFields = Partial<
  Pick<SessionNote, "working_on" | "accomplished" | "next_steps">
>;

// Updates today's note for a student. Closed (finalized) days can't change.
async function updateToday(
  studentId: string,
  update: Record<string, unknown> | Record<string, unknown>[],
): Promise<ActionResult> {
  const result = await sessionNotesCollection().updateOne(
    {
      student_id: studentId,
      session_date: todayInPacific(),
      finalized: { $ne: true },
    },
    update,
  );
  return result.matchedCount === 1
    ? { ok: true }
    : {
        ok: false,
        error: "They're not checked in today, or the day is closed.",
      };
}

const MAX_NOTE_LENGTH = 5000;

export type SaveNotesResult =
  | { ok: true }
  | { ok: false; error: string }
  // Someone else saved these fields since this sensei loaded them.
  | {
      ok: false;
      conflict: true;
      current: NoteFields;
      edited_by?: string;
    };

// Saves a student's note text for today (any of the three boxes). `bases`
// is each field's value when the sensei started editing; if the stored note
// has changed since, nothing is saved and the current values come back, so
// nobody's work is overwritten without them choosing to.
export async function saveNotes(
  studentId: string,
  fields: NoteFields,
  bases: NoteFields,
): Promise<SaveNotesResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "You're not signed in." };

  const by = await editedBy(session);
  const set: Record<string, unknown> = {
    last_edited: new Date().toISOString(),
    ...(by && { edited_by: by }),
  };
  const unchanged: Record<string, unknown>[] = [];
  for (const key of ["working_on", "accomplished", "next_steps"] as const) {
    const value = fields[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > MAX_NOTE_LENGTH) {
      return { ok: false, error: "That note is too long." };
    }
    set[key] = value;
    const base = bases[key] ?? "";
    unchanged.push(
      base === ""
        ? {
            $or: [
              { [key]: { $exists: false } },
              { [key]: "" },
              { [key]: null },
            ],
          }
        : { [key]: base },
    );
  }

  const date = todayInPacific();
  const result = await sessionNotesCollection().updateOne(
    {
      student_id: studentId,
      session_date: date,
      finalized: { $ne: true },
      ...(unchanged.length && { $and: unchanged }),
    },
    { $set: set },
  );
  if (result.matchedCount === 1) return { ok: true };

  const current = await sessionNotesCollection().findOne(
    { student_id: studentId, session_date: date, finalized: { $ne: true } },
    {
      projection: {
        _id: 0,
        working_on: 1,
        accomplished: 1,
        next_steps: 1,
        edited_by: 1,
      },
    },
  );
  if (!current) {
    return {
      ok: false,
      error: "They're not checked in today, or the day is closed.",
    };
  }
  const { edited_by, ...noteFields } = current as NoteFields & {
    edited_by?: string;
  };
  return { ok: false, conflict: true, current: noteFields, edited_by };
}

export async function setDebriefed(
  studentId: string,
  debriefed: boolean,
): Promise<ActionResult> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };
  return updateToday(studentId, { $set: { debriefed: debriefed === true } });
}

async function activitiesFor(belt: { belt_id: number; belt_level?: number }) {
  const path = await db
    .collection<{ activities: Activity[] }>("belt_paths")
    .findOne(
      {
        belt_id: belt.belt_id,
        ...(belt.belt_level !== undefined && { belt_level: belt.belt_level }),
      },
      { projection: { _id: 0, activities: 1 } },
    );
  return path?.activities ?? [];
}

// Sets the student's current activity (one from their current level).
export async function changeActivity(
  studentId: string,
  activityId: string,
): Promise<ActionResult> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };
  const student = await studentsCollection().findOne(
    { id: studentId },
    { projection: { _id: 0, belt: 1 } },
  );
  if (!student) return { ok: false, error: "That student doesn't exist." };
  const activity = (await activitiesFor(student.belt)).find(
    (a) => (a.activity_id ?? a.title) === activityId,
  );
  if (!activity)
    return { ok: false, error: "That activity isn't on their level." };
  await studentsCollection().updateOne(
    { id: studentId },
    { $set: { current_activity: activity } },
  );
  return { ok: true };
}

export type ProgressResult =
  | {
      ok: true;
      belt: Belt;
      activity: Activity | null;
      starsAdded: number;
      // Today's accomplishments, with the level/belt up line added.
      accomplished: string;
    }
  | { ok: false; error: string };

// Moves a student to a new belt/level: checks they're still where the sensei
// saw them (so two senseis can't double it), adds stars, sets the first
// activity of the new level, and adds `line` to today's accomplishments.
async function progress(
  studentId: string,
  from: { belt_id: number; belt_level?: number },
  to: Belt,
  starsAdded: number,
  line: string,
): Promise<ProgressResult> {
  const activity = (await activitiesFor(to))[0] ?? null;
  const updated = await studentsCollection().findOneAndUpdate(
    {
      id: studentId,
      "belt.belt_id": from.belt_id,
      ...(from.belt_level !== undefined
        ? { "belt.belt_level": from.belt_level }
        : { "belt.belt_level": { $exists: false } }),
    },
    activity
      ? {
          $set: { belt: to, current_activity: activity },
          $inc: { stars: starsAdded },
        }
      : {
          $set: { belt: to },
          $unset: { current_activity: "" },
          $inc: { stars: starsAdded },
        },
  );
  if (!updated) {
    return { ok: false, error: "Their belt changed already. Reload the page." };
  }

  // Append the line to today's accomplishments, in one update.
  await updateToday(studentId, [
    {
      $set: {
        accomplished: {
          $cond: [
            { $gt: [{ $strLenCP: { $ifNull: ["$accomplished", ""] } }, 0] },
            { $concat: ["$accomplished", "\n", line] },
            line,
          ],
        },
        last_edited: new Date().toISOString(),
      },
    },
  ]);
  const note = await sessionNotesCollection().findOne(
    { student_id: studentId, session_date: todayInPacific() },
    { projection: { _id: 0, accomplished: 1 } },
  );
  return {
    ok: true,
    belt: to,
    activity,
    starsAdded,
    accomplished: note?.accomplished ?? line,
  };
}

// Level up within a belt: + that belt's stars per level (none for Bronze and
// up). Not on a belt's last level; that's a belt up.
export async function levelUp(
  studentId: string,
  from: { belt_id: number; belt_level?: number },
): Promise<ProgressResult> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };
  const belt = (await getBelts()).find((b) => b.belt_id === from.belt_id);
  const level = from.belt_level;
  if (!belt || level === undefined || !belt.levels || level >= belt.levels) {
    return { ok: false, error: "They're on the last level; that's a belt up." };
  }
  const student = await studentsCollection().findOne(
    { id: studentId },
    { projection: { _id: 0, belt: 1 } },
  );
  const to: Belt = {
    belt_id: belt.belt_id,
    belt_title: belt.title,
    belt_level: level + 1,
    ...(student?.belt.belt_type && { belt_type: student.belt.belt_type }),
  };
  return progress(
    studentId,
    from,
    to,
    belt.stars_per_level ?? 0,
    `LEVEL UP -> ${capitalize(belt.title)} ${level + 1}`,
  );
}

// Belt up from a belt's last level (or Junior): + the rest of the belt's
// stars (next belt's running total minus what they've earned), none for
// Junior or Bronze and up. Moving to a typed belt needs Godot or Unity.
export async function beltUp(
  studentId: string,
  from: { belt_id: number; belt_level?: number },
  beltType?: string,
): Promise<ProgressResult> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };
  const belts = await getBelts();
  const current = belts.find((b) => b.belt_id === from.belt_id);
  const next = belts.find((b) => b.belt_id === from.belt_id + 1);
  if (!current || !next) return { ok: false, error: "There's no next belt." };
  if (current.levels && (from.belt_level ?? 0) < current.levels) {
    return { ok: false, error: "They're not on the last level yet." };
  }
  const student = await studentsCollection().findOne(
    { id: studentId },
    { projection: { _id: 0, belt: 1 } },
  );
  const type = next.has_type
    ? current.has_type
      ? student?.belt.belt_type
      : beltType
    : undefined;
  if (next.has_type && type !== "godot" && type !== "unity") {
    return { ok: false, error: "Pick Godot or Unity." };
  }

  const earned = earnedStars(current, from.belt_level);
  const starsAdded =
    earned !== null && next.running_total !== null
      ? Math.max(0, next.running_total - earned)
      : 0;

  return progress(
    studentId,
    from,
    {
      belt_id: next.belt_id,
      belt_title: next.title,
      belt_level: 1,
      ...(type && { belt_type: type }),
    },
    starsAdded,
    `BELT UP -> ${capitalize(next.title)} Belt`,
  );
}

// Save Day: after the cards have saved their notes, marks everyone checked in
// today as having had a session today.
export async function saveDay(): Promise<
  { ok: true; students: number } | { ok: false; error: string }
> {
  if (!(await auth())) return { ok: false, error: "You're not signed in." };
  const date = todayInPacific();
  const ids = await sessionNotesCollection().distinct("student_id", {
    session_date: date,
  });
  if (ids.length) {
    await studentsCollection().updateMany(
      { id: { $in: ids } },
      { $set: { last_session: date } },
    );
  }
  return { ok: true, students: ids.length };
}
