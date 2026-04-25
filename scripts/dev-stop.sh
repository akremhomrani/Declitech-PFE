#!/usr/bin/env bash
# DecliTech — Stop all services and clean logs
# Usage: ./scripts/dev-stop.sh [--name <svc>] [--keep-logs]

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/logs/services"

TARGET=""
KEEP_LOGS=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --name)      TARGET="$2"; shift ;;
    --keep-logs) KEEP_LOGS=true      ;;
  esac
  shift
done

log()  { echo "[$(date +%H:%M:%S)] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] ✓ $*"; }
fail() { echo "[$(date +%H:%M:%S)] ✗ $*" >&2; }

# ── Kill by PID file, with port fallback ──────────────────────────────────────
kill_service() {
  local name=$1 port=$2
  local killed=false

  # Try PID file first
  local pidfile="$LOG_DIR/$name.pid"
  if [[ -f "$pidfile" ]]; then
    local pid; pid=$(cat "$pidfile")
    if kill "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null || true
      ok "Stopped $name (PID $pid)"
      killed=true
    fi
    rm -f "$pidfile"
  fi

  # Fallback: find by port via netstat and kill via taskkill
  if [[ -n "$port" ]]; then
    local pids
    pids=$(netstat -ano 2>/dev/null | grep ":$port" | grep "LISTENING" | awk '{print $5}' | sort -u)
    for pid in $pids; do
      [[ "$pid" =~ ^[0-9]+$ ]] || continue
      taskkill //PID "$pid" //F > /dev/null 2>&1 && ok "Stopped $name (port :$port PID $pid)" && killed=true
    done
  fi

  $killed || log "$name was not running"
}

# ── Service → port map ────────────────────────────────────────────────────────
port_of() {
  case $1 in
    redis)    echo 6379 ;;
    eureka)   echo 8761 ;;
    auth)     echo 8083 ;;
    session)  echo 8084 ;;
    report)   echo 8081 ;;
    gateway)  echo 8080 ;;
    agent)    echo 8765 ;;
    frontend) echo 4200 ;;
    *)        echo ""   ;;
  esac
}

# ── Stop one ──────────────────────────────────────────────────────────────────
stop_one() {
  local port; port=$(port_of "$TARGET")
  [[ -z "$port" ]] && { fail "Unknown: $TARGET. Valid: redis eureka auth session report gateway agent frontend"; exit 1; }
  kill_service "$TARGET" "$port"
  if ! $KEEP_LOGS; then
    rm -f "$LOG_DIR/$TARGET.log"
    ok "Cleared $TARGET.log"
  fi
}

# ── Stop all ──────────────────────────────────────────────────────────────────
stop_all() {
  log "Stopping all services..."
  for svc in redis eureka auth session report gateway agent frontend; do
    kill_service "$svc" "$(port_of $svc)"
  done

  if ! $KEEP_LOGS; then
    log "Cleaning logs..."
    rm -f "$LOG_DIR"/*.log "$LOG_DIR"/*.pid
    rm -f "$ROOT/logs"/*.log 2>/dev/null || true
    ok "All logs deleted"
  fi
  log "Done."
}

# ── Main ──────────────────────────────────────────────────────────────────────
if [[ -n "$TARGET" ]]; then
  stop_one
else
  stop_all
fi
