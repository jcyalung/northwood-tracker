# Deploying on the Pi

Moved to [docs/raspberry-pi.md](docs/raspberry-pi.md), which covers what runs
on the Pi, deploying changes, logs, safe shutdown and troubleshooting.

Quick deploy, from the repo root:

```sh
cd northwood-tracker && npm ci && npm run build && sudo systemctl restart northwood
```
