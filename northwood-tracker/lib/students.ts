import { pathKey, type BeltInfo, type BeltPaths } from "@/lib/belts";
import { db } from "@/lib/mongodb";
import { sessionHours } from "@/lib/sessions";
import type { StudentTag } from "@/lib/tags";

// Shapes follow rsrc/SCHEMA.md.
export type Activity = {
  activity_id?: string;
  type?: string;
  title: string;
};

export type Belt = {
  belt_id: number;
  belt_title: string;
  belt_level?: number;
  // Only set for Bronze (belt_id 10) and higher, e.g. "godot" or "unity".
  belt_type?: string;
};

export type Student = {
  id: string;
  first_name: string;
  last_name: string;
  // null when the parent email or birthday isn't known yet (e.g. students
  // migrated from the old export).
  parent_email: string | null;
  // MM/DD/YYYY
  birthday: string | null;
  belt: Belt;
  // Required by SCHEMA.md, but the example students don't have it yet.
  stars?: number;
  current_activity?: Activity;
  // Several tags, each possibly expiring; see lib/tags.ts.
  tags?: StudentTag[];
  // Older single label (early example data); read by activeTags().
  label?: string;
  notes?: string;
  // Fields from rsrc/pages/ALL.md (not in SCHEMA.md yet).
  program?: "Create" | "Junior" | "Robotics";
  debrief_method?: string;
  // MM/DD/YYYY; null or missing if they've never attended.
  last_session?: string | null;
};

// A Session Notes document. `session_date` is copied from the session so
// history can be listed without joining Sessions.
export type SessionNote = {
  session_id: string;
  session_date: string;
  student_id: string;
  session_hour: string;
  debriefed: boolean;
  working_on?: string;
  accomplished?: string;
  next_steps?: string;
  // Locked by the daily close.
  finalized?: boolean;
  // ISO timestamp of the last change (the check-in time for new notes).
  last_edited?: string;
  // Email of the sensei who made the last change.
  edited_by?: string;
};

export type HourGroup = { hour: string; students: Student[] };

export const sessionNotesCollection = () =>
  db.collection<SessionNote>("session_notes");

// A day's check-ins, from that day's Session Notes: students grouped into
// every check-in hour (even empty ones) in check-in order, plus each
// student's note for the day.
export async function getSessionForDate(
  date: string,
  students: Student[],
): Promise<{ hours: HourGroup[]; notes: Record<string, SessionNote> }> {
  const byId = new Map(students.map((s) => [s.id, s]));
  const dayNotes = await sessionNotesCollection()
    .find({ session_date: date }, { projection: { _id: 0 } })
    .sort({ last_edited: 1 })
    .toArray();

  return {
    hours: sessionHours(date).map((hour) => ({
      hour,
      students: dayNotes
        .filter((n) => n.session_hour === hour)
        .map((n) => byId.get(n.student_id))
        .filter((s): s is Student => s !== undefined),
    })),
    notes: Object.fromEntries(dayNotes.map((n) => [n.student_id, n])),
  };
}

// Each belt level's activities, from the `belt_paths` collection (loaded
// from rsrc/curriculum.md).
export async function getBeltPaths(): Promise<BeltPaths> {
  const paths = await db
    .collection<{
      belt_id: number;
      belt_level?: number;
      activities: Activity[];
    }>("belt_paths")
    .find({}, { projection: { _id: 0 } })
    .toArray();
  return Object.fromEntries(
    paths.map((path) => [pathKey(path), path.activities]),
  );
}

export const studentsCollection = () => db.collection<Student>("students");

// Every student in MongoDB. Pages must call `await connection()` first so
// this runs per request, not at build time.
export async function getAllStudents(): Promise<Student[]> {
  return studentsCollection()
    .find({}, { projection: { _id: 0 } })
    .toArray();
}

// Every Session Note, grouped by student.
export async function getSessionHistory(): Promise<
  Record<string, SessionNote[]>
> {
  const byStudent: Record<string, SessionNote[]> = {};
  const notes = await sessionNotesCollection()
    .find({}, { projection: { _id: 0 } })
    .toArray();
  for (const note of notes) {
    (byStudent[note.student_id] ??= []).push(note);
  }
  return byStudent;
}

export type CurriculumBelt = {
  belt_id: number;
  belt_title: string;
  levels: { belt_level: number; activities: Activity[] }[];
};

// The curriculum, belt by belt in belt order, each with its levels in order.
export async function getCurriculum(): Promise<CurriculumBelt[]> {
  const paths = await db
    .collection<{
      belt_id: number;
      belt_title: string;
      belt_level: number;
      activities: Activity[];
    }>("belt_paths")
    .find({}, { projection: { _id: 0 } })
    .sort({ belt_id: 1, belt_level: 1 })
    .toArray();

  const belts: CurriculumBelt[] = [];
  for (const p of paths) {
    let belt = belts.at(-1);
    if (belt?.belt_id !== p.belt_id) {
      belt = { belt_id: p.belt_id, belt_title: p.belt_title, levels: [] };
      belts.push(belt);
    }
    belt.levels.push({ belt_level: p.belt_level, activities: p.activities });
  }
  return belts;
}

// Every belt, in order, from the `belts` collection.
export async function getBelts(): Promise<BeltInfo[]> {
  return db
    .collection<BeltInfo>("belts")
    .find({}, { projection: { _id: 0 } })
    .sort({ belt_id: 1 })
    .toArray();
}
