#!/usr/bin/env bash
# DecliTech — Restart services (clears logs, starts fresh)
# Usage: ./scripts/dev-restart.sh [--name <svc>]

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$ROOT/scripts"
LOG_DIR="$ROOT/logs/services"

TARGET=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --name) TARGET="$2"; shift ;;
  esac
  shift
done

log() { echo "[$(date +%H:%M:%S)] $*"; }

if [[ -n "$TARGET" ]]; then
  log "Restarting $TARGET..."
  bash "$SCRIPTS/dev-stop.sh"  --name "$TARGET"
  bash "$SCRIPTS/dev-start.sh" --name "$TARGET"
else
  log "Restarting everything..."
  bash "$SCRIPTS/dev-stop.sh"
  bash "$SCRIPTS/dev-start.sh"
fi
