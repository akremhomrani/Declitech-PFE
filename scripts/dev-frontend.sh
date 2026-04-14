#!/usr/bin/env bash
# DecliTech — Angular frontend

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/declitech-frontend"
LOG_DIR="$ROOT/logs/services"
mkdir -p "$LOG_DIR"

log()  { echo "[$(date +%H:%M:%S)] [frontend] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] [frontend] ✓ $*"; }
fail() { echo "[$(date +%H:%M:%S)] [frontend] ✗ $*" >&2; }
is_up() { (echo >/dev/tcp/localhost/"$1") 2>/dev/null; }

if is_up 4200; then
  ok "Frontend already up"
  exit 0
fi

log "Starting Angular frontend..."
cd "$FRONTEND"
nohup npx ng serve --open > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$LOG_DIR/frontend.pid"
cd "$ROOT"

for i in $(seq 1 90); do
  is_up 4200 && ok "Frontend :4200" && exit 0
  sleep 1
done
fail "Frontend did not start after 90s"; exit 1
