#!/usr/bin/env bash
set -euo pipefail

RELEASES=/var/www/declitech/releases
SERVICE="${1:?usage: rollback.sh <service> [version]}"
TARGET="${2:-}"
dir="$RELEASES/$SERVICE"

if [ ! -d "$dir" ]; then
  echo "unknown service: $SERVICE"
  exit 1
fi

current=""
[ -L "$dir/current.jar" ] && current="$(readlink "$dir/current.jar")"

if [ -z "$TARGET" ]; then
  TARGET="$(ls -1t "$dir"/*.jar 2>/dev/null | grep -v '/current.jar$' | grep -v -F "$(basename "$current")" | head -1 || true)"
else
  TARGET="$dir/$TARGET.jar"
fi

if [ -z "$TARGET" ] || [ ! -f "$TARGET" ]; then
  echo "no rollback target found for $SERVICE"
  echo "available versions:"
  ls -1t "$dir"/*.jar 2>/dev/null | grep -v '/current.jar$' || true
  exit 1
fi

echo "rolling $SERVICE back to $(basename "$TARGET")"
ln -sfn "$TARGET" "$dir/current.jar"
sudo systemctl restart "declitech@$SERVICE"
sleep 6
systemctl is-active "declitech@$SERVICE"
