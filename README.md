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
  interactive journey, and a read-only database browser (MongoDB or SQL view).
- **Save Day** — saves all progress and records each student's last session.

## Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions) + React + Tailwind CSS
- MongoDB (Docker)
- Email + password sign-in (Auth.js; passwords hashed with scrypt) for two
  accounts: the manager, and a central account the senseis share. After
  signing in to the central account, each sensei picks their name, and their
  edits say "Last edited by <first name>"
- Built to run on a Raspberry Pi 5

## Running it locally

```sh
docker compose up -d          # MongoDB on localhost:27017
cd northwood-tracker
npm install
cp .env.example .env          # then fill in the values below
npm run dev                   # http://localhost:3000
```

`.env` needs:

| Variable | What it's for |
|---|---|
| `MONGODB_CONN` | MongoDB connection string |
| `MONGODB_DB` | Database name (defaults to `northwood`) |
| `AUTH_SECRET` | Session encryption (`npx auth secret`) |
| `MANAGER_EMAIL` | The manager account (adds and removes senseis). Creates its password on first sign-in |
| `CENTRAL_EMAIL` | The shared account senseis sign in with. Creates its password on first sign-in |
| `STARS_PASSWORD` | Required to change a student's stars in All Students |

## Data

Student records, session notes, the curriculum, and belts live in MongoDB.
Scripts in `northwood-tracker/scripts/migrate/` import them from spreadsheet
exports and a curriculum file; source data is kept out of the repo (`rsrc/` is
git-ignored) because it contains student information.

## Docs

Kept locally in `rsrc/` (git-ignored): the schema, page specs, the saving and
live-update design (`PLAN.md`), and the Raspberry Pi deployment notes
(`DEPLOY_PI.md`).

## Icons

The belt, menu, and Godot/Unity icons in `northwood-tracker/public/icons/`
aren't in the repo (they're brand artwork). Add them locally to run the app
with icons.
