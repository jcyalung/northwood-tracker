# Northwood Tracker

A small learning management system (LMS) for a kids' coding center. Senseis
(instructors) use it to run each day's sessions: who's coming in, what each
student is working on, their progress through the belt curriculum, and the
stars they earn and spend.

## What it does

- **Schedule** — the lead sensei checks students in to each hour before
  sessions start (weekdays 2–5 PM, weekends 1–4 PM, Pacific time).
- **Students Today** — one card per checked-in student. Senseis record what
  they're working on, what they accomplished, and what's next. Notes autosave
  3 seconds after typing stops (or right away with the card's Save button or
  Ctrl+Enter, ⌘+Enter on Mac), and every open copy of the page stays in sync (with a "use theirs / keep
  mine" choice if two senseis edit the same note). Each new session starts
  from the last session's "work on next".
- **Belts and levels** — students move through a belt curriculum (White
  through Gold) of builds, quests, and adventures. Level ups and belt ups award
  stars and are added to the day's accomplishments.
- **All Students** — searchable, filterable roster with session history,
  editing, new students, and CSV export.
- **Star Store** — students redeem stars for prizes; balances can't go negative.
- **Dashboard** — attendance and program/belt charts, the curriculum as an
  interactive journey, the senseis list, a read-only database browser
  (MongoDB or SQL view) with a manager-only export, and a live activity log.
- **Debrief Helper** — a debrief checklist and talking points for every belt,
  level and activity.
- **Save Day** — saves all progress and records each student's last session
  (also runs automatically at 7 PM).
- **Backups** — a daily backup of the database and attendance, optionally
  copied to Google Drive.

## Documentation

| Guide | For |
|---|---|
| [User guide](docs/user-guide.md) | Signing in and using every page (senseis and the manager) |
| [Running the Raspberry Pi](docs/raspberry-pi.md) | What runs on the Pi, startup, daily jobs, deploying changes, logs, safe shutdown, troubleshooting |
| [Backups](docs/backups.md) | Daily backups to `data-backup/` and Google Drive, and restoring |
| [Deploying on another computer](docs/deploying-elsewhere.md) | Running it on Linux or Windows, and moving the data |

## Technologies

- **Next.js 16** (App Router, Server Actions) with **React 19** and **Tailwind CSS 4**
- **MongoDB**, in Docker, through the official MongoDB Node.js driver (v7)
- **Auth.js** email + password sign-in (passwords hashed with scrypt)
- On the Pi: **nginx** (port 80), **systemd** (the app and its daily jobs),
  **avahi** (the `northwood.local` name), **rclone** (Google Drive backups)

## Running it locally

```sh
docker compose up -d          # MongoDB on localhost:27017
cd northwood-tracker
npm install
cp .env.example .env          # then fill it in
npm run dev                   # http://localhost:3000
```

The `.env` variables are described in
[Running the Raspberry Pi → Configuration](docs/raspberry-pi.md#configuration-env-files).

## Data

Student records, session notes, the curriculum, and belts live in MongoDB.
Scripts in `northwood-tracker/scripts/migrate/` import them from spreadsheet
exports and a curriculum file. Source data and backups are kept out of the
repo (`rsrc/`, `export/` and `data-backup/` are git-ignored) because they
contain student information. The Debrief Helper's text is in
`northwood-tracker/content/debrief-help.md`.

## Icons

The belt, menu, and Godot/Unity icons in `northwood-tracker/public/icons/`
aren't in the repo (they're brand artwork). Add them locally to run the app
with icons.
