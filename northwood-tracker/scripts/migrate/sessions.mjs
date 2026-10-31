// Builds the `sessions` collection (one record per day: which students were
// checked in to each hour) from `session_notes`, which has one note per
// student per day. Replaces the collection. Dry run unless --write.
//
// Usage: node --env-file=.env scripts/migrate/sessions.mjs <database> [--write]
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";

const [dbName, flag] = process.argv.slice(2);
if (!dbName) {
  console.error("Usage: sessions.mjs <database> [--write]");
  process.exit(1);
}
const write = flag === "--write";

const client = new MongoClient(process.env.MONGODB_CONN);
try {
  const db = client.db(dbName);
  const names = new Map(
    (
      await db
        .collection("students")
        .find({}, { projection: { _id: 0, id: 1, first_name: 1, last_name: 1 } })
        .toArray()
    ).map((s) => [s.id, `${s.first_name} ${s.last_name}`]),
  );
  const notes = await db
    .collection("session_notes")
    .find({}, { projection: { _id: 0, session_date: 1, session_hour: 1, student_id: 1 } })
    .sort({ last_edited: 1 })
    .toArray();

  // date -> hour -> students, in check-in order.
  const days = new Map();
  for (const n of notes) {
    if (!days.has(n.session_date)) days.set(n.session_date, {});
    const hours = days.get(n.session_date);
    (hours[n.session_hour] ??= []).push({
      student_id: n.student_id,
      student_name: names.get(n.student_id) ?? null,
    });
  }
  const sessions = [...days].map(([date, session]) => ({
    session_id: randomUUID(),
    date,
    session,
  }));

  console.log(
    `${write ? "WRITING" : "DRY RUN"} -> "${dbName}": ${sessions.length} days from ${notes.length} check-ins`,
  );
  if (write) {
    const col = db.collection("sessions");
    await col.deleteMany({});
    if (sessions.length) await col.insertMany(sessions);
    await col.createIndex({ date: 1 }, { unique: true });
    console.log("  done.");
  }
} finally {
  await client.close();
}
