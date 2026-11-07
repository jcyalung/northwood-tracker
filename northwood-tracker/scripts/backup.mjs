// Daily backup: writes the whole database (as JSON, one file per collection)
// and each day's check-ins (as CSV) to data-backup/ at the repo root,
// partitioned by year and month, then copies that folder to Google Drive
// if BACKUP_RCLONE_REMOTE is set. Run daily at 7:30 PM Pacific by the
// northwood-backup systemd timer (see deploy/systemd/).
//
//   data-backup/YYYY/MM/database/YYYY-MM-DD/<collection>.json
//   data-backup/YYYY/MM/attendance/YYYY-MM-DD.csv
//
// The `accounts` collection (password hashes) is never backed up.
//
// Usage: node --env-file=.env scripts/backup.mjs
// Optional .env settings:
//   BACKUP_DIR            where to write (default: <repo root>/data-backup)
//   BACKUP_RCLONE_REMOTE  rclone destination, e.g. "gdrive:Northwood Backups"
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const TIME_ZONE = "America/Los_Angeles";
// Never backed up: password hashes.
const SKIP = new Set(["accounts"]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(
  process.env.BACKUP_DIR || path.join(scriptDir, "..", "..", "data-backup"),
);
const REMOTE = process.env.BACKUP_RCLONE_REMOTE?.trim() || "";

// Today's Pacific calendar date as { year, month, day } strings.
function todayInPacific(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

// "MM/DD/YYYY" (how session dates are stored) -> { year, month, day }.
function fromSessionDate(date) {
  const [month, day, year] = date.split("/");
  return { year, month, day };
}
const iso = (d) => `${d.year}-${d.month}-${d.day}`;
const sessionDate = (d) => `${d.month}/${d.day}/${d.year}`;
const monthDir = (d) => path.join(BACKUP_DIR, d.year, d.month);

const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

// CSV cell, same rules as lib/csv.ts: quote commas/quotes/line breaks and
// neutralize text a spreadsheet would run as a formula.
function cell(value) {
  let text = value === undefined || value === null ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(","));
  // BOM so Excel reads it as UTF-8.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// "3 PM" -> 15, for sorting check-in hours.
function hourValue(hour) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(String(hour).trim());
  if (!m) return 99;
  let h = Number(m[1]) % 12;
  if (m[3]?.toUpperCase() === "PM") h += 12;
  return h + Number(m[2] ?? 0) / 60;
}

async function backupDatabase(db, today) {
  const dir = path.join(monthDir(today), "database", iso(today));
  const tmp = `${dir}.partial`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !SKIP.has(name) && !name.startsWith("system."))
    .sort();
  const counts = {};
  for (const name of names) {
    const docs = await db
      .collection(name)
      .find({}, { projection: { _id: 0 } })
      .toArray();
    counts[name] = docs.length;
    await writeFile(
      path.join(tmp, `${name}.json`),
      JSON.stringify(docs, null, 2) + "\n",
    );
  }
  // Swap in the finished folder, so a half-written day never looks complete.
  await rm(dir, { recursive: true, force: true });
  await rename(tmp, dir);
  console.log(
    `Database: ${path.relative(BACKUP_DIR, dir)}/ (${names.length} collections: ${names
      .map((n) => `${n} ${counts[n]}`)
      .join(", ")})`,
  );
}

async function writeAttendance(db, date, students) {
  const notes = await db
    .collection("session_notes")
    .find(
      { session_date: sessionDate(date) },
      { projection: { _id: 0, student_id: 1, session_hour: 1 } },
    )
    .toArray();
  const rows = notes
    .map((n) => {
      const s = students.get(n.student_id);
      return {
        first: s?.first_name ?? "",
        last: s?.last_name ?? `(unknown student ${n.student_id})`,
        hour: n.session_hour ?? "",
      };
    })
    .sort(
      (a, b) =>
        hourValue(a.hour) - hourValue(b.hour) ||
        a.last.localeCompare(b.last) ||
        a.first.localeCompare(b.first),
    );
  const dir = path.join(monthDir(date), "attendance");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${iso(date)}.csv`);
  const tmp = `${file}.partial`;
  await writeFile(
    tmp,
    toCsv(
      ["date", "first_name", "last_name", "hour"],
      rows.map((r) => [iso(date), r.first, r.last, r.hour]),
    ),
  );
  await rename(tmp, file);
  return { file, count: rows.length };
}

async function backupAttendance(db, today) {
  const students = new Map(
    (
      await db
        .collection("students")
        .find({}, { projection: { _id: 0, id: 1, first_name: 1, last_name: 1 } })
        .toArray()
    ).map((s) => [s.id, s]),
  );

  // Today's file is rewritten every run.
  const t = await writeAttendance(db, today, students);
  console.log(
    `Attendance: ${path.relative(BACKUP_DIR, t.file)} (${t.count} checked in)`,
  );

  // Backfill past days that have check-ins but no CSV yet.
  const dates = await db.collection("session_notes").distinct("session_date");
  let backfilled = 0;
  for (const d of dates) {
    if (typeof d !== "string" || !/^\d{2}\/\d{2}\/\d{4}$/.test(d)) continue;
    const date = fromSessionDate(d);
    if (iso(date) >= iso(today)) continue;
    const file = path.join(monthDir(date), "attendance", `${iso(date)}.csv`);
    if (await exists(file)) continue;
    await writeAttendance(db, date, students);
    backfilled++;
  }
  if (backfilled) console.log(`Attendance: backfilled ${backfilled} past days`);
}

function copyToRemote() {
  if (!REMOTE) {
    console.log(
      "Google Drive: BACKUP_RCLONE_REMOTE not set, so the backup is local only",
    );
    return;
  }
  const result = spawnSync(
    "rclone",
    [
      "copy",
      BACKUP_DIR,
      REMOTE,
      "--exclude",
      "*.partial/**",
      "--exclude",
      "*.partial",
      "--exclude",
      ".backup.lock",
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (result.error?.code === "ENOENT") {
    throw new Error(
      "rclone isn't installed, so the backup wasn't copied to Google Drive (sudo apt install rclone)",
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `rclone copy to "${REMOTE}" failed (exit ${result.status}). Check "rclone config" and the remote name.`,
    );
  }
  console.log(`Google Drive: copied ${BACKUP_DIR} to "${REMOTE}"`);
}

// One backup at a time (Save Day can start one while the 7:30 PM one runs):
// wait for the other to finish. A lock left by a process that died is
// taken over.
const LOCK = path.join(BACKUP_DIR, ".backup.lock");
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};
async function lock() {
  await mkdir(BACKUP_DIR, { recursive: true });
  const deadline = Date.now() + 20 * 60 * 1000;
  let said = false;
  for (;;) {
    try {
      await writeFile(LOCK, String(process.pid), { flag: "wx" });
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const pid = Number(await readFile(LOCK, "utf8").catch(() => ""));
    if (!pid || !alive(pid)) {
      await rm(LOCK, { force: true });
      continue;
    }
    if (Date.now() > deadline) {
      throw new Error(`Another backup (process ${pid}) is still running`);
    }
    if (!said) console.log("Waiting for another backup to finish…");
    said = true;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
const unlock = () => rm(LOCK, { force: true });

try {
  await lock();
} catch (error) {
  console.error(`Backup error: ${error.message}`);
  process.exit(1);
}

const today = todayInPacific();
console.log(`Backing up ${iso(today)} to ${BACKUP_DIR}`);

const client = new MongoClient(process.env.MONGODB_CONN);
try {
  try {
    const db = client.db(process.env.MONGODB_DB || "northwood");
    await backupDatabase(db, today);
    await backupAttendance(db, today);
  } finally {
    await client.close();
  }
  copyToRemote();
} catch (error) {
  console.error(`Backup error: ${error.message}`);
  await unlock();
  process.exit(1);
}
await unlock();
console.log("Backup finished");
