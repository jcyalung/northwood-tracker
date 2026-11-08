# Backups

The Pi backs up the database every day, keeps the backups in a folder on the
Pi, and (once set up) copies them to Google Drive.

- [What gets backed up](#what-gets-backed-up)
- [The data-backup folder](#the-data-backup-folder)
- [Google Drive](#google-drive)
- [Running a backup by hand](#running-a-backup-by-hand)
- [Restoring](#restoring)

---

## What gets backed up

There are two backups:

| Backup | When | What |
|---|---|---|
| **Attendance** | Every **Save Day** click, and nightly at **7:30 PM** (`northwood-backup.timer`) | One CSV per day of who was checked in |
| **Database** | Weekly, **Sundays at 7:45 PM** (`northwood-database-backup.timer`) | The whole database |

Both are Pacific time, and both run at the next boot if the Pi was off
(`Persistent=true`). Save Day backups run in the background; the result
shows in Dashboard → Logs under "Backups".

```sh
cd /home/jcyal/Documents/northwood-tracker/northwood-tracker
node --env-file=.env scripts/backup.mjs              # attendance
node --env-file=.env scripts/backup.mjs --database   # database
```

1. **Attendance**: one CSV per day listing who was checked in, with columns
   `date, first_name, last_name, hour`. Days that don't have a CSV yet
   (including past days, the first time it runs) are filled in, so the
   attendance history is complete.
2. **Database**: every collection (students, session notes, sessions,
   senseis, belts, belt paths, purchases, …) as a JSON file, **except
   `accounts`** (password hashes stay off backups). Each file is a JSON array
   of that collection's documents, without MongoDB's internal `_id`. Because
   it's weekly, restoring one loses changes made since that Sunday; for
   anything newer, use **Dashboard → Database → Export database** first.

Two backups never run at the same time: if one starts while another is
running, it waits.

---

## The data-backup folder

Backups are written to **`data-backup/`** at the repo root
(`/home/jcyal/Documents/northwood-tracker/data-backup`), split into folders by
year and month:

```
data-backup/
  2026/
    11/
      attendance/
        2026-11-05.csv
        2026-11-06.csv
    12/
      …
  database-backups/
    2026/
      11/
        2026-11-08/
          students.json
          session_notes.json
          sessions.json
          senseis.json
          belts.json
          belt_paths.json
          purchases.json
        2026-11-15/
          …
```

Google Drive's **Northwood Backups** folder has the same layout, so the
weekly database snapshots are in **Northwood Backups/database-backups/**.

An attendance CSV looks like:

```csv
date,first_name,last_name,hour
2026-11-06,Alex,Example,3 PM
```

**`data-backup/` contains student information.** It's git-ignored and must
never be committed or shared publicly. Each weekly database snapshot is a
full copy, so you can delete old month folders if disk space ever gets low
(the Pi's SD card has plenty of room for years of these).

---

## Google Drive

Optional. When set up, every backup run also copies `data-backup/` to a
Google Drive folder using [rclone](https://rclone.org). It uses
`rclone copy`, which **only adds and updates files in Drive; it never deletes
anything there**, even if a file is removed from the Pi.

It's on when `BACKUP_RCLONE_REMOTE` is set in `northwood-tracker/.env`, e.g.:

```sh
BACKUP_RCLONE_REMOTE="gdrive:Northwood Backups"
```

`gdrive` is the name of an rclone remote, and `Northwood Backups` is the
folder in Drive. Setting it up, once:

1. Install rclone: `sudo apt install rclone` (already done on the Pi).
2. In a terminal on the Pi's desktop, run `rclone config`:
   - `n` (new remote), name it **`gdrive`**.
   - Storage: **`drive`** (Google Drive).
   - `client_id` and `client_secret`: leave blank (Enter).
   - Scope: **`drive.file`** ("Access to files created by rclone only"), so
     rclone can only see the backups it creates, not the rest of the Drive.
   - `service_account_file`: blank. "Edit advanced config": `n`.
   - "Use web browser to automatically authenticate": `y`, then sign in with
     the Google account that should own the backups and click **Allow**.
     (Over SSH with no browser: answer `n`, run `rclone authorize "drive"` on
     a computer with a browser and rclone, and paste the token it prints.)
   - "Shared Drive": `n`. Keep the remote: `y`. Quit: `q`.
3. Check it: `rclone lsd gdrive:` runs without an error.
4. Add the `BACKUP_RCLONE_REMOTE=…` line above to `northwood-tracker/.env`.
5. Run a backup by hand (below) and check the **Northwood Backups** folder
   appears in Drive.

If the Drive copy fails (no internet, expired sign-in), the
local backup is still written and the error shows in
`journalctl -u northwood-backup`. To re-do the Google sign-in:
`rclone config reconnect gdrive:`.

To turn Drive copying off, remove the `BACKUP_RCLONE_REMOTE` line.

---

## Running a backup by hand

```sh
sudo systemctl start northwood-backup.service            # attendance (the nightly run)
sudo systemctl start northwood-database-backup.service   # database (the weekly run)
journalctl -u northwood-backup -n 20                     # what they did
journalctl -u northwood-database-backup -n 20
```

Or directly:

```sh
cd /home/jcyal/Documents/northwood-tracker/northwood-tracker
node --env-file=.env scripts/backup.mjs              # attendance
node --env-file=.env scripts/backup.mjs --database   # database
```

When the next backups are due: `systemctl list-timers 'northwood-*'`.

The manager can also download the whole database at any time from
**Dashboard → Database → Export database** (one JSON file).

---

## Restoring

Restoring **replaces** collections in the database. Try it on a spare
database name first, and take a fresh backup before restoring over the live
database.

The loader is `northwood-tracker/scripts/migrate/load.mjs`. It reads **one
JSON file** shaped like `{ "students": [...], "session_notes": [...], ... }`,
replaces each collection in that file (collections not in the file are left
alone), and recreates their indexes. Without `--write` it only shows what it
would do.

### From Dashboard → Database → Export database

That file is already in the right shape:

```sh
cd /home/jcyal/Documents/northwood-tracker/northwood-tracker
node --env-file=.env scripts/migrate/load.mjs ~/Downloads/<export>.json <database>            # dry run
node --env-file=.env scripts/migrate/load.mjs ~/Downloads/<export>.json <database> --write    # do it
```

### From a weekly database backup folder

The database backup has **one file per collection**, so combine a day's files
into one first:

```sh
cd /home/jcyal/Documents/northwood-tracker/northwood-tracker
node -e '
const fs = require("fs"), path = require("path");
const dir = process.argv[1], out = {};
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith(".json")) out[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
}
fs.writeFileSync("restore.json", JSON.stringify(out));
console.log("Wrote restore.json:", Object.keys(out).join(", "));
' ../data-backup/database-backups/2026/11/2026-11-08

node --env-file=.env scripts/migrate/load.mjs restore.json <database>            # dry run
node --env-file=.env scripts/migrate/load.mjs restore.json <database> --write    # do it
rm restore.json                                                                  # contains student data
```

`<database>` is the `MONGODB_DB` name from `.env`. Then restart the app:
`sudo systemctl restart northwood`.

Notes:

- Account passwords aren't in backups. After restoring into a fresh
  database, the manager and center accounts create new passwords at their
  next sign-in.
- JSON stores dates as text. The app writes most of its dates as text
  already, but Star Store purchase dates come back as text rather than
  MongoDB dates. For an exact copy of everything (including passwords and
  date types), use a MongoDB dump instead, see
  [Deploying elsewhere → Moving the data](deploying-elsewhere.md#moving-the-data).
