// Automatic Save Day: sets each checked-in student's last session to the
// day, like the Save Day button. Run daily at 7 PM Pacific by the
// northwood-save-day systemd timer (see DEPLOY.md). Run before 7 PM (a
// catch-up after the Pi was off), it saves the previous day instead.
//
// Usage: node --env-file=.env scripts/save-day.mjs
import { MongoClient } from "mongodb";

const TIME_ZONE = "America/Los_Angeles";
const SAVE_HOUR = 19;

// The Pacific calendar day whose 7 PM most recently passed, as MM/DD/YYYY
// (the format session dates are stored in). Calendar math, so daylight
// saving days don't shift it.
function dayToSave(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, Number(p.value)]),
  );
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour < SAVE_HOUR) day.setUTCDate(day.getUTCDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(day.getUTCMonth() + 1)}/${pad(day.getUTCDate())}/${day.getUTCFullYear()}`;
}

const date = dayToSave();

// "MM/DD/YYYY" -> "YYYYMMDD", so dates compare in order.
const sortable = (d) =>
  d ? `${d.slice(6)}${d.slice(0, 2)}${d.slice(3, 5)}` : "";

const client = new MongoClient(process.env.MONGODB_CONN);
try {
  const db = client.db(process.env.MONGODB_DB || "northwood");
  const ids = await db
    .collection("session_notes")
    .distinct("student_id", { session_date: date });
  // Never move a last session backwards (a catch-up run after a later
  // session was already saved).
  const students = await db
    .collection("students")
    .find(
      { id: { $in: ids } },
      { projection: { _id: 0, id: 1, last_session: 1 } },
    )
    .toArray();
  const update = students
    .filter((s) => sortable(s.last_session) < sortable(date))
    .map((s) => s.id);
  if (update.length) {
    await db
      .collection("students")
      .updateMany({ id: { $in: update } }, { $set: { last_session: date } });
  }
  console.log(
    `Saved ${date}: ${ids.length} checked in, ${update.length} updated`,
  );
} finally {
  await client.close();
}
