#!/usr/bin/env bash
# DecliTech — Spring Boot services (Eureka → parallel services)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/declitech-backend"
LOG_DIR="$ROOT/logs/services"
mkdir -p "$LOG_DIR"

export JAVA_HOME="${JAVA_HOME:-/c/Program Files/Java/jdk-17}"
export PATH="$JAVA_HOME/bin:$PATH"
export MAVEN_OPTS="${MAVEN_OPTS:--XX:TieredStopAtLevel=1 -Xms64m -Xmx256m}"

MVN="$(which mvn 2>/dev/null)"
if [[ -z "$MVN" ]]; then
  MVN=$(find /c/Users/Akrem/.m2/wrapper/dists -name "mvn" ! -name "*.cmd" 2>/dev/null | sort -V | tail -1)
fi
[[ -z "$MVN" ]] && { echo "ERROR: mvn not found." >&2; exit 1; }

log()  { echo "[$(date +%H:%M:%S)] [backend] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] [backend] ✓ $*"; }
fail() { echo "[$(date +%H:%M:%S)] [backend] ✗ $*" >&2; }
is_up() { (echo >/dev/tcp/localhost/"$1") 2>/dev/null; }
wait_for_port() {
  local name=$1 port=$2 max=${3:-60}
  for i in $(seq 1 $max); do
    is_up "$port" && ok "$name :$port" && return 0
    sleep 1
  done
  fail "$name did not start on :$port after ${max}s"; return 1
}

launch() {
  local name=$1 dir=$2 port=$3
  if is_up "$port"; then ok "$name already up"; return 0; fi
  log "Launching $name..."
  cd "$BACKEND/$dir"
  nohup "$MVN" spring-boot:run -q > "$LOG_DIR/$name.log" 2>&1 &
  echo $! > "$LOG_DIR/$name.pid"
  cd "$ROOT"
}

# Eureka must be up before the rest register
if is_up 8761; then
  ok "Eureka already up"
else
  log "Starting Eureka..."
  cd "$BACKEND/eureka-server"
  nohup "$MVN" spring-boot:run -q > "$LOG_DIR/eureka.log" 2>&1 &
  echo $! > "$LOG_DIR/eureka.pid"
  cd "$ROOT"
  wait_for_port "Eureka" 8761 60 || exit 1
fi

# Launch remaining services simultaneously
launch "auth"    auth-service    8083
launch "session" session-service 8084
launch "report"  report-service  8081
launch "module"  module-service  8085
launch "gateway" gateway-service 8080

# Wait for all in parallel
log "Waiting for all services..."
wait_for_port "auth"    8083 60 &
wait_for_port "session" 8084 60 &
wait_for_port "report"  8081 60 &
wait_for_port "module"  8085 60 &
wait_for_port "gateway" 8080 60 &
wait
