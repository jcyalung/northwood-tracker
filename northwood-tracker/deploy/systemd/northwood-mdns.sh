#!/bin/sh
# Publish northwood.local -> this Pi's LAN IP over mDNS, and re-publish
# whenever that IP changes (new network, DHCP renewal, Wi-Fi coming up late).
lan_ip() {
  # The address used for the default route: the LAN, never a Docker bridge.
  ip -4 route get 1.1.1.1 2>/dev/null |
    awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}

PID=
CURRENT=
trap '[ -n "$PID" ] && kill "$PID" 2>/dev/null; exit 0' TERM INT
while :; do
  IP=$(lan_ip)
  if [ "$IP" != "$CURRENT" ] || { [ -n "$PID" ] && ! kill -0 "$PID" 2>/dev/null; }; then
    [ -n "$PID" ] && kill "$PID" 2>/dev/null && wait "$PID" 2>/dev/null
    PID=
    CURRENT=$IP
    if [ -n "$IP" ]; then
      echo "publishing northwood.local -> $IP"
      /usr/bin/avahi-publish -a -R northwood.local "$IP" &
      PID=$!
    else
      echo "no LAN address yet; waiting"
    fi
  fi
  sleep 15
done
