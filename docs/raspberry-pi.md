# Running the Raspberry Pi

How Northwood Tracker runs on the center's Raspberry Pi 5: what starts on its
own, the daily jobs, how to deploy changes, where the logs are, and how to
shut it down safely. For whoever looks after the Pi.

The app is at **http://northwood.local** on the local network only
(`http://<pi-ip>` also works). Nothing is exposed to the internet.

- [What runs on the Pi](#what-runs-on-the-pi)
- [Startup](#startup)
- [Daily jobs](#daily-jobs)
- [Deploying changes](#deploying-changes)
- [Configuration (.env files)](#configuration-env-files)
- [Logs](#logs)
- [Checking it's healthy](#checking-its-healthy)
- [Shutting down and restarting](#shutting-down-and-restarting)
- [Troubleshooting](#troubleshooting)

Paths below are relative to the repo at
`/home/jcyal/Documents/northwood-tracker` (the "repo root"); the Next.js app
is in its `northwood-tracker/` folder.

---

## What runs on the Pi

| Piece | What it is | How it runs |
|---|---|---|
| **MongoDB** | The database | Docker container `mongodb` from `docker-compose.yml` at the repo root, `restart: unless-stopped`. Listens on `127.0.0.1:27017` only (nothing else on the network can reach it). Data lives in the Docker volume `northwood-tracker_mongo_data`. |
| **The app** | Next.js production server | systemd `northwood.service`: `next start -H 127.0.0.1 -p 3000` as user `jcyal`, in `northwood-tracker/`, reading `northwood-tracker/.env`. Restarts itself 5 seconds after a crash. |
| **nginx** | Web server in front of the app | `/etc/nginx/sites-available/northwood`: port 80 → `127.0.0.1:3000`. Buffering is off so live updates stream. |
| **northwood.local** | The name devices use | systemd `northwood-mdns.service` runs `/usr/local/bin/northwood-mdns`, which publishes `northwood.local` over mDNS (avahi) for the Pi's current LAN IP and re-publishes it if the IP changes. |
| **Save Day at 7 PM** | Automatic Save Day | systemd `northwood-save-day.timer` → `northwood-save-day.service` |
| **Backup at 7:30 PM** | Nightly attendance backup (and Google Drive copy if set up); also after every Save Day | systemd `northwood-backup.timer` → `northwood-backup.service` ([Backups](backups.md)) |
| **Database backup, Sundays 7:45 PM** | Weekly whole-database backup (and Google Drive copy) | systemd `northwood-database-backup.timer` → `northwood-database-backup.service` |

The service files are in `/etc/systemd/system/` (`northwood.service`,
`northwood-mdns.service`, `northwood-save-day.service`/`.timer`,
`northwood-backup.service`/`.timer`,
`northwood-database-backup.service`/`.timer`). Copies of all of them (and the
`northwood-mdns` script) are kept in the repo at
`northwood-tracker/deploy/systemd/`; if you change one on the Pi, update the
copy too.

The app's services run Node from nvm, with the path written into the service
files: `/home/jcyal/.config/nvm/versions/node/v24.14.1/bin/node`. If Node is
upgraded, update those paths and run `sudo systemctl daemon-reload`.

---

## Startup

Everything starts by itself when the Pi is plugged in. Nobody needs to log in.
Give it a minute or two after power-on.

In order:

1. **Docker** starts and brings the `mongodb` container back up (because of
   `restart: unless-stopped`).
2. **avahi** and **northwood-mdns** publish `northwood.local` once the network
   is up.
3. **northwood.service** starts the app (it waits for Docker).
4. **nginx** serves port 80.
5. **Timers** are armed. If the Pi was off at 7 PM, 7:30 PM or (Sundays) 7:45 PM, the missed
   Save Day and backup run now (`Persistent=true`).

---

## Daily jobs

### Save Day, 7 PM Pacific

- Timer: `northwood-save-day.timer` (`OnCalendar=*-*-* 19:00:00
  America/Los_Angeles`, `Persistent=true`).
- Runs: `node --env-file=.env scripts/save-day.mjs` in `northwood-tracker/`.
- Does the same as the Save Day button: sets each student checked in that day
  to have their **last session** on that day. It doesn't touch notes (those
  autosave).
- If it runs before 7 PM (a catch-up after the Pi was off), it saves the
  **previous** day. So if the Pi was off overnight and comes back on the next
  day before 7 PM, the missed day is still saved. If it comes back after
  7 PM, only that day is saved, so click **Save Day** before turning the Pi
  off early.
- If MongoDB is still starting, the service retries every 30 seconds.
- Log: `journalctl -u northwood-save-day`.

### Attendance backup, 7:30 PM Pacific (and after Save Day)

- Timer: `northwood-backup.timer` (daily at 7:30 PM Pacific,
  `Persistent=true`, so a missed backup runs at the next boot). The app also
  starts one after every Save Day click.
- Runs: `node --env-file=.env scripts/backup.mjs` in `northwood-tracker/`.
- Writes attendance CSVs to `data-backup/` at the repo root, and copies them
  to Google Drive if that's set up.
- Log: `journalctl -u northwood-backup` (Save Day ones: Dashboard → Logs).

### Database backup, Sundays 7:45 PM Pacific

- Timer: `northwood-database-backup.timer` (weekly, `Persistent=true`).
- Runs: `node --env-file=.env scripts/backup.mjs --database`.
- Writes the whole database to `data-backup/database-backups/`, and copies it
  to Google Drive (**Northwood Backups/database-backups/**).
- Log: `journalctl -u northwood-database-backup`.
- Details, file layout and restoring: [Backups](backups.md).

Run either job by hand at any time:

```sh
sudo systemctl start northwood-save-day.service
sudo systemctl start northwood-backup.service
sudo systemctl start northwood-database-backup.service
```

See when they next run:

```sh
systemctl list-timers 'northwood-*'
```

---

## Deploying changes

After pulling new code or editing anything in `northwood-tracker/` (pages,
`content/debrief-help.md`, files in `public/`):

```sh
cd /home/jcyal/Documents/northwood-tracker/northwood-tracker
npm ci                              # install exact dependencies (only needed if package-lock.json changed, harmless otherwise)
npm run build                       # build the production app into .next/
sudo systemctl restart northwood    # switch to the new build
```

Or in one line:

```sh
cd northwood-tracker && npm ci && npm run build && sudo systemctl restart northwood
```

- The restart takes the app offline for a few seconds. Do it **outside
  class hours** if you can, and have senseis save their cards first (unsaved
  text in an open card is only in that browser).
- `npm run build` writes into `.next/`, which the running app also uses.
  Restart right after building.
- Anyone with a page open should reload it after a deploy.
- Only files in `northwood-tracker/public/` at build time are served (belt and
  menu icons live there, and aren't in git).

After changing **only** `northwood-tracker/.env`, a restart is enough:

```sh
sudo systemctl restart northwood
```

After changing a systemd unit file:

```sh
sudo systemctl daemon-reload
sudo systemctl restart <the unit>
```

---

## Configuration (.env files)

There are two `.env` files. Both are git-ignored and must never be committed
or shared.

**Repo root `.env`**: used by `docker compose` to create the MongoDB admin
user:

| Variable | What it's for |
|---|---|
| `MONGO_ROOT_USERNAME` | MongoDB admin user name |
| `MONGO_ROOT_PASSWORD` | MongoDB admin password |

**`northwood-tracker/.env`**: used by the app and the scripts (template:
`northwood-tracker/.env.example`):

| Variable | What it's for |
|---|---|
| `MONGODB_CONN` | MongoDB connection string, e.g. `mongodb://<user>:<password>@127.0.0.1:27017/?authSource=admin` |
| `MONGODB_DB` | Database name (defaults to `northwood`) |
| `AUTH_SECRET` | Encrypts sign-in sessions. Generate with `npx auth secret`. Changing it signs everyone out. |
| `AUTH_TRUST_HOST` | `true`, so sign-in works at both northwood.local and the IP |
| `MANAGER_EMAIL` | The manager account's email |
| `CENTRAL_EMAIL` | The shared center account's email |
| `STARS_PASSWORD` | Password for changing a student's stars in All Students |
| `BACKUP_RCLONE_REMOTE` | Optional. Where backups are copied, e.g. `gdrive:Northwood Backups`. See [Backups](backups.md#google-drive) |

Changing `MANAGER_EMAIL` or `CENTRAL_EMAIL` signs out the old account
everywhere; the new email creates its password on its first sign-in.

### Resetting a forgotten account password

Passwords are stored (hashed) in the `accounts` collection. Deleting an
account's entry lets it create a new password at its next sign-in:

```sh
docker exec -it mongodb mongosh -u <MONGO_ROOT_USERNAME> -p --authenticationDatabase admin
# then, in mongosh (use the MONGODB_DB name):
use <database>
db.accounts.deleteOne({ email: "<the account email>" })
```

---

## Logs

| What | Where |
|---|---|
| App activity (sign-ins, check-ins, debriefs, Save Day, failed saves, errors) | **Dashboard → Logs** in the app (since the last restart), and `journalctl -u northwood` (full history) |
| App, live | `journalctl -u northwood -f` |
| Today only | `journalctl -u northwood --since today` |
| Just problems | `journalctl -u northwood --since today \| grep -E "\[(warn\|error)\]"` |
| Save Day job | `journalctl -u northwood-save-day` |
| Backup jobs | `journalctl -u northwood-backup`, `journalctl -u northwood-database-backup` |
| northwood.local name | `journalctl -u northwood-mdns -n 5` |
| Every web request | `sudo tail -f /var/log/nginx/access.log` |
| MongoDB | `docker logs mongodb --tail 50` |

App log lines look like `[warn] [sign-in] Failed sign-in for … - Wrong
password, from 192.168.x.x`. The system journal keeps them across restarts.

---

## Checking it's healthy

```sh
systemctl status northwood                 # should say active (running)
docker ps                                  # mongodb should be Up
curl -I http://northwood.local/login       # expect HTTP 200
systemctl list-timers 'northwood-*'        # next Save Day and backup
```

Or open **Dashboard → Logs**: the Database tile should say **Connected** and
Errors should be 0.

---

## Shutting down and restarting

**Don't just pull the plug.** Cutting power while running can corrupt the SD
card or the database files.

1. Have everyone save their cards (and click **Save Day** if it's before
   7 PM, since the automatic one won't run while the Pi is off).
2. Shut down:
   ```sh
   sudo poweroff
   ```
3. Wait about 10 seconds until the green light stops flashing, then unplug.

To restart: `sudo reboot`. Everything comes back by itself
([Startup](#startup)).

What's kept across a shutdown: all data (students, notes, check-ins, senseis,
accounts), the full system log, and the backups. Dashboard → Logs starts
empty again and its uptime resets.

---

## Troubleshooting

### Can't reach northwood.local

- Find the Pi's address with `hostname -I` (the first one) and try
  `http://<that IP>`. If the IP works, it's name lookup on that device. If
  it doesn't, the device is on a different network than the Pi (or the Wi-Fi
  isolates devices from each other).
- `journalctl -u northwood-mdns -n 5` shows which IP `northwood.local` points
  to.
- Reserving the Pi's IP in the router keeps the IP stable.
- The Pi's Wi-Fi power saving is turned off
  (`/etc/NetworkManager/conf.d/wifi-powersave-off.conf`) because it made
  devices hang on "waiting". Keep it off.

### The page says something went wrong, or the Database tile says Unreachable

```sh
docker ps                      # is mongodb Up?
docker compose up -d           # from the repo root, starts it if not
sudo systemctl restart northwood
```

### The app won't start after a deploy

```sh
journalctl -u northwood -n 50
```

Usually a failed build: run `npm run build` again in `northwood-tracker/` and
read the error.

### Senseis see "Leave site?" or "Unsaved notes"

Their notes haven't saved yet. Have them click the card's **Save** (or
Ctrl/Cmd + Enter) while the Pi is reachable.
