# Deploying on Another Computer

How to run Northwood Tracker on a different Linux machine or a Windows PC,
and how to move the data over. The app itself doesn't depend on the
Raspberry Pi; it needs **Node.js**, **MongoDB**, and something to keep it
running.

- [What you need](#what-you-need)
- [Linux](#linux)
- [Windows](#windows)
- [Moving the data](#moving-the-data)
- [After moving](#after-moving)

---

## What you need

- **Node.js 24** (or the current LTS; the Pi runs 24.14).
- **MongoDB**, run in Docker (easiest) or installed directly.
- **Git**, to get the code.
- The **icons** in `northwood-tracker/public/icons/`. They aren't in git;
  copy that folder from the Pi.
- A filled-in `northwood-tracker/.env` (copy it from the Pi, or start from
  `.env.example`). See
  [Raspberry Pi → Configuration](raspberry-pi.md#configuration-env-files)
  for every variable.

The server should be **always on** and on the center's network, with a fixed
IP (reserve one in the router) so devices can always find it.

---

## Linux

Debian/Ubuntu commands; other distributions are similar.

### 1. Install Docker, Node and Git

```sh
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin   # or Docker's own packages
sudo usermod -aG docker $USER                              # then log out and back in

# Node via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# open a new terminal, then:
nvm install 24
```

### 2. Get the code and start MongoDB

```sh
git clone https://github.com/jcyalung/northwood-tracker.git
cd northwood-tracker
```

Create the repo-root `.env` with the MongoDB admin login:

```sh
MONGO_ROOT_USERNAME=<admin user>
MONGO_ROOT_PASSWORD=<a strong password>
```

```sh
docker compose up -d        # MongoDB on 127.0.0.1:27017, restarts on boot
```

### 3. Configure, install and build the app

```sh
cd northwood-tracker
cp .env.example .env        # fill it in (MONGODB_CONN uses the user/password above)
npm ci
npm run build
npm start                   # try it: http://<this machine's IP>:3000
```

`npm start` listens on all addresses on port 3000. Stop it with Ctrl+C once it
works and set it up as a service.

### 4. Run it as a service (starts on boot)

Create `/etc/systemd/system/northwood.service` (replace `<user>` and the
paths; `which node` prints the Node path):

```ini
[Unit]
Description=Northwood Tracker (Next.js)
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=<user>
WorkingDirectory=/home/<user>/northwood-tracker/northwood-tracker
Environment=NODE_ENV=production
ExecStart=/path/to/node /home/<user>/northwood-tracker/northwood-tracker/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

(`-H 127.0.0.1` keeps the app private behind nginx. Without nginx, use
`-H 0.0.0.0` and open port 3000 in the firewall.)

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now northwood
```

### 5. nginx on port 80 (optional, recommended)

```sh
sudo apt install -y nginx
```

Copy `/etc/nginx/sites-available/northwood` from the Pi (it proxies port 80
to `127.0.0.1:3000` with buffering off for live updates), then:

```sh
sudo ln -s /etc/nginx/sites-available/northwood /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 6. A friendly name (optional)

Devices reach the server by its hostname over mDNS: a machine named
`northwood` is `http://northwood.local` (with `avahi-daemon` installed and
running, which most desktop Linux has). Set the name with
`sudo hostnamectl set-hostname northwood`. The Pi instead uses a small
`northwood-mdns` service to publish the name; copy
`/usr/local/bin/northwood-mdns` and `northwood-mdns.service` from the Pi if
you want the same setup.

### 7. Daily jobs

Copy these unit files from `northwood-tracker/deploy/systemd/` in the repo, change the user,
paths and Node path, then enable the timers:

- `northwood-save-day.service` + `.timer` (7 PM Save Day)
- `northwood-backup.service` + `.timer` (7:30 PM backup)

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now northwood-save-day.timer northwood-backup.timer
```

For Google Drive backups, install rclone and set it up as in
[Backups → Google Drive](backups.md#google-drive).

Deploying updates afterwards is the same as on the Pi:
`npm ci && npm run build && sudo systemctl restart northwood`.

---

## Windows

### 1. Install the tools

- **Docker Desktop** (https://www.docker.com/products/docker-desktop). In
  its settings, turn on *Start Docker Desktop when you sign in*.
- **Node.js LTS** (https://nodejs.org, the Windows installer).
- **Git for Windows** (https://git-scm.com).

### 2. Get the code and start MongoDB

In PowerShell:

```powershell
git clone https://github.com/jcyalung/northwood-tracker.git
cd northwood-tracker
notepad .env      # add MONGO_ROOT_USERNAME=... and MONGO_ROOT_PASSWORD=...
docker compose up -d
```

The container restarts whenever Docker Desktop starts.

### 3. Configure, install and build

```powershell
cd northwood-tracker
copy .env.example .env
notepad .env      # fill in MONGODB_CONN, AUTH_SECRET, emails, STARS_PASSWORD
npm ci
npm run build
npm start         # http://localhost:3000
```

### 4. Keep it running and start it at boot

Pick one:

- **NSSM** (https://nssm.cc) turns it into a Windows service:
  ```powershell
  nssm install Northwood "C:\Program Files\nodejs\npm.cmd" start
  nssm set Northwood AppDirectory C:\path\to\northwood-tracker\northwood-tracker
  nssm set Northwood AppEnvironmentExtra NODE_ENV=production
  nssm start Northwood
  ```
  It restarts the app if it stops. Make sure Docker Desktop has started
  before the app needs the database (the app retries on each page load).
- **Task Scheduler**: create a task that runs at startup, *Run whether user
  is logged on or not*, action `npm.cmd` with arguments `start` and *Start
  in* set to the `northwood-tracker\northwood-tracker` folder.

### 5. Let other devices reach it

Other devices use `http://<the PC's IP>:3000`. Allow the port through Windows
Defender Firewall (PowerShell as administrator):

```powershell
New-NetFirewallRule -DisplayName "Northwood Tracker" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Set the center's network to *Private* in Windows network settings. To use
port 80 (no `:3000` in the address), put a reverse proxy in front, such as
nginx for Windows or Caddy, using the same settings as the Pi's nginx site
(buffering off).

### 6. Daily jobs with Task Scheduler

Windows has no systemd timers; create two scheduled tasks instead:

| Task | When | Program | Arguments | Start in |
|---|---|---|---|---|
| Northwood Save Day | Daily 7:00 PM | `node` | `--env-file=.env scripts\save-day.mjs` | `...\northwood-tracker\northwood-tracker` |
| Northwood Backup | Daily 7:30 PM | `node` | `--env-file=.env scripts\backup.mjs` | `...\northwood-tracker\northwood-tracker` |

On each task tick *Run task as soon as possible after a scheduled start is
missed* (the same catch-up as the Pi's timers). Set the PC's time zone to
Pacific, or adjust the times. For Google Drive, install rclone for Windows
and run `rclone config` as in [Backups](backups.md#google-drive).

Deploying updates: stop the service or task, run `npm ci` and
`npm run build`, then start it again.

---

## Moving the data

### Option A: a full MongoDB dump (exact copy, recommended)

Copies everything, including account passwords and exact date types. On the
Pi:

```sh
docker exec mongodb mongodump -u <MONGO_ROOT_USERNAME> -p <MONGO_ROOT_PASSWORD> \
  --authenticationDatabase admin --db <MONGODB_DB> --archive --gzip > northwood.archive.gz
```

Copy `northwood.archive.gz` to the new machine (USB drive, `scp`), then
there:

```sh
docker exec -i mongodb mongorestore -u <MONGO_ROOT_USERNAME> -p <MONGO_ROOT_PASSWORD> \
  --authenticationDatabase admin --archive --gzip < northwood.archive.gz
```

(On Windows, run these in Git Bash, or use PowerShell with
`cmd /c "docker exec ... > northwood.archive.gz"` so the file isn't
re-encoded.) Delete the archive afterwards; it contains student data and
password hashes.

### Option B: from a backup or export

Use a daily backup folder from `data-backup/` (or Google Drive), or the
manager's **Dashboard → Database → Export database** file, and load it with
`scripts/migrate/load.mjs` as described in
[Backups → Restoring](backups.md#restoring). Passwords aren't included, so
both accounts create new passwords on their first sign-in.

---

## After moving

- Sign in with both accounts and check Students Today, All Students and the
  Dashboard.
- Make sure the old server is shut down (or its app stopped) so senseis
  don't keep saving to it.
- Update anything that pointed at the old address (bookmarks, the router's
  reserved IP).
- Copy over `data-backup/` if you want the backup history on the new machine.
