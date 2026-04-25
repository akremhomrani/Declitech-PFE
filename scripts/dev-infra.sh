#!/usr/bin/env bash
# DecliTech — Redis + Python Agent

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REDIS_DIR="$ROOT/Redis"
AGENT="$ROOT/declitech-backend/agent-service"
LOG_DIR="$ROOT/logs/services"
mkdir -p "$LOG_DIR"

log()  { echo "[$(date +%H:%M:%S)] [infra] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] [infra] ✓ $*"; }
fail() { echo "[$(date +%H:%M:%S)] [infra] ✗ $*" >&2; }
is_up() { (echo >/dev/tcp/localhost/"$1") 2>/dev/null; }
wait_for_port() {
  local name=$1 port=$2 max=${3:-30}
  for i in $(seq 1 $max); do
    is_up "$port" && ok "$name :$port" && return 0
    sleep 1
  done
  fail "$name did not start on :$port after ${max}s"; return 1
}

# Redis
if is_up 6379; then
  ok "Redis already up"
else
  log "Starting Redis..."
  cd "$REDIS_DIR"
  nohup ./redis-server.exe ./redis.windows.conf > "$LOG_DIR/redis.log" 2>&1 &
  echo $! > "$LOG_DIR/redis.pid"
  cd "$ROOT"
  wait_for_port "Redis" 6379 15 || exit 1
fi

# Agent (starts right after Redis)
if is_up 8765; then
  ok "Agent already up"
elif [[ ! -f "$AGENT/.venv/Scripts/python.exe" ]]; then
  fail "Agent venv missing — run: cd declitech-backend/agent-service && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt"
else
  log "Starting Python agent..."
  cd "$AGENT"
  nohup .venv/Scripts/python.exe main.py > "$LOG_DIR/agent.log" 2>&1 &
  echo $! > "$LOG_DIR/agent.pid"
  cd "$ROOT"
  wait_for_port "Agent" 8765 30
fi
