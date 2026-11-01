# Deploying on the Pi

The app runs on the Raspberry Pi at **http://northwood.local** (local network
only; `http://<pi-ip>` also works).

## Deploy

From the repo root, after pulling or changing code:

```sh
cd northwood-tracker && npm ci && npm run build && sudo systemctl restart northwood
```

Also needed after adding files to `northwood-tracker/public/` (only files there
at build time are served). After changing only `northwood-tracker/.env`, a
restart is enough:

```sh
sudo systemctl restart northwood
```

## Can't reach northwood.local?

- Find the Pi's address with `hostname -I` (the first one) and try `http://<that IP>`.
  If the IP works, it's name lookup on that device; if it doesn't, the device
  is on a different network than the Pi (or the Wi-Fi isolates devices).
- `journalctl -u northwood-mdns -n 5` shows which IP `northwood.local` points to.
- Giving the Pi a reserved IP in the router keeps the IP fallback stable.

## Check it

```sh
systemctl status northwood                     # the app
journalctl -u northwood -f                     # its logs
curl -I http://northwood.local/login           # expect 200
```

## What's running

| Piece | How |
|---|---|
| MongoDB | `docker compose up -d` (repo root). Bound to `127.0.0.1:27017`; password in the repo-root `.env` |
| App | systemd `northwood.service`: `next start` on `127.0.0.1:3000`, reads `northwood-tracker/.env` |
| nginx | `/etc/nginx/sites-available/northwood`: port 80 → 3000 |
| Save Day at 7 PM | systemd `northwood-save-day.timer` runs `scripts/save-day.mjs` daily at 7 PM Pacific (catches up at boot if the Pi was off). Log: `journalctl -u northwood-save-day` |
| `northwood.local` | systemd `northwood-mdns.service` publishes the name over mDNS (avahi) for the Pi's current LAN IP, and re-publishes if it changes |

All of them start on boot. The service runs Node from nvm
(`~/.config/nvm/versions/node/v24.14.1`); if the Node version changes, update
the paths in `/etc/systemd/system/northwood.service` and run
`sudo systemctl daemon-reload`.
