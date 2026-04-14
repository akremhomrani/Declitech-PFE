#!/usr/bin/env bash
# DecliTech — Start everything (infra + backend + frontend in parallel)
# Usage: ./scripts/dev-start.sh [--infra] [--backend] [--frontend] [--name <svc>]

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$ROOT/scripts"
LOG_DIR="$ROOT/logs/services"
mkdir -p "$LOG_DIR"

START_TIME=$(date +%s)
log()  { echo "[$(date +%H:%M:%S)] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] ✓ $*"; }
fail() { echo "[$(date +%H:%M:%S)] ✗ $*" >&2; }
is_up() { (echo >/dev/tcp/localhost/"$1") 2>/dev/null; }

# ── Parse args ────────────────────────────────────────────────────────────────
ONLY=""
TARGET=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --infra)    ONLY="infra"    ;;
    --backend)  ONLY="backend"  ;;
    --frontend) ONLY="frontend" ;;
    --name)     TARGET="$2"; shift ;;
  esac
  shift
done

# ── Single service restart ────────────────────────────────────────────────────
start_one() {
  case $TARGET in
    redis|agent)           bash "$SCRIPTS/dev-infra.sh"    ;;
    eureka|auth|session|\
    report|module|gateway) bash "$SCRIPTS/dev-backend.sh"  ;;
    frontend)              bash "$SCRIPTS/dev-frontend.sh" ;;
    *) fail "Unknown: $TARGET. Valid: redis agent eureka auth session report module gateway frontend"; exit 1 ;;
  esac
}

# ── Main ──────────────────────────────────────────────────────────────────────
if [[ -n "$TARGET" ]]; then
  start_one
elif [[ -n "$ONLY" ]]; then
  bash "$SCRIPTS/dev-$ONLY.sh"
else
  log "Starting infra + backend + frontend in parallel..."
  bash "$SCRIPTS/dev-infra.sh"    &  PID_INFRA=$!
  bash "$SCRIPTS/dev-backend.sh"  &  PID_BACKEND=$!
  bash "$SCRIPTS/dev-frontend.sh" &  PID_FRONTEND=$!

  wait $PID_INFRA    ; INFRA_OK=$?
  wait $PID_BACKEND  ; BACKEND_OK=$?
  wait $PID_FRONTEND ; FRONTEND_OK=$?

  echo ""
  log "─── Status ──────────────────────────────"
  for entry in "Redis:6379" "Agent:8765" "Eureka:8761" "Auth:8083" "Session:8084" "Report:8081" "Module:8085" "Gateway:8080" "Frontend:4200"; do
    name="${entry%%:*}"; port="${entry##*:}"
    is_up "$port" && ok "$name :$port" || fail "$name :$port"
  done

  ELAPSED=$(( $(date +%s) - START_TIME ))
  log "─────────────────────────────────────────"
  log "Done in ${ELAPSED}s"

  [[ $INFRA_OK -eq 0 && $BACKEND_OK -eq 0 && $FRONTEND_OK -eq 0 ]] || exit 1
fi
