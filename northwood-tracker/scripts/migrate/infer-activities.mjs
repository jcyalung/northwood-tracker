// Sets `current_activity` for students who don't have one, from their
// session notes: the first activity on their current belt level whose title
// appears in their newest notes (latest "working on", then its "next time",
// then older notes). The old export had no current-activity column.
// Dry run unless --write.
//
// Usage: node --env-file=.env scripts/migrate/infer-activities.mjs <database> [--write]
import { MongoClient } from "mongodb";

const [dbName, flag] = process.argv.slice(2);
if (!dbName) {
  console.error("Usage: infer-activities.mjs <database> [--write]");
  process.exit(1);
}
const write = flag === "--write";
// How many recent notes to search per student.
const NOTES_SEARCHED = 3;

// Letters and digits only, so "Avoid the Snakes!" matches "avoid the snakes".
const normalize = (text) =>
  (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const client = new MongoClient(process.env.MONGODB_CONN);
try {
  const db = client.db(dbName);
  const students = await db
    .collection("students")
    .find({ current_activity: { $exists: false } })
    .toArray();

  let found = 0;
  const unmatched = [];
  for (const s of students) {
    const path = await db.collection("belt_paths").findOne({
      belt_id: s.belt.belt_id,
      ...(s.belt.belt_level !== undefined && { belt_level: s.belt.belt_level }),
    });
    const notes = await db
      .collection("session_notes")
      .find({ student_id: s.id })
      .sort({ last_edited: -1 })
      .limit(NOTES_SEARCHED)
      .toArray();
    if (!notes.length) continue; // Never attended: "First session" is right.

    const texts = notes.flatMap((n, i) =>
      i === 0 ? [n.working_on, n.next_steps] : [n.working_on],
    );
    let activity = null;
    for (const text of texts) {
      activity = path?.activities.find((a) =>
        normalize(text).includes(normalize(a.title)),
      );
      if (activity) break;
    }
    if (activity) {
      found++;
      if (write) {
        await db
          .collection("students")
          .updateOne({ id: s.id }, { $set: { current_activity: activity } });
      }
    } else {
      unmatched.push(
        `${s.first_name} ${s.last_name} (${s.belt.belt_title} ${s.belt.belt_level ?? ""})`,
      );
    }
  }
  console.log(
    `${write ? "WROTE" : "DRY RUN"} -> "${dbName}": ${found} activities found from notes; ${unmatched.length} with sessions but no activity named on their level (shown as "Activity not set").`,
  );
} finally {
  await client.close();
}
