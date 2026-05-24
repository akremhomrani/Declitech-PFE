#!/usr/bin/env bash
set -euo pipefail

RELEASES=/var/www/declitech/releases
VERSION="${1:?version required}"
shift
CHANGED="$*"

declare -A PORTS=(
  [eureka-server]=8761
  [gateway-service]=8080
  [auth-service]=8083
  [session-service]=8084
  [user-service]=8086
  [module-service]=8087
  [report-service]=8081
)
ORDER="eureka-server gateway-service auth-service user-service module-service session-service report-service"
KEEP=5
HEALTH_TIMEOUT=90

wait_listening() {
  local port=$1 waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    if ss -tln 2>/dev/null | grep -q ":$port "; then return 0; fi
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

deploy_one() {
  local s=$1
  local dir="$RELEASES/$s"
  local newjar="$dir/$VERSION.jar"
  local port="${PORTS[$s]:-}"

  if [ "$(systemctl is-enabled "declitech@$s" 2>/dev/null)" = "disabled" ]; then
    echo ">>> $s: skipped (service is disabled)"
    return 0
  fi

  if [ ! -f "$newjar" ]; then
    echo "::error:: $s — artifact $newjar not found"
    return 1
  fi
  if [ -z "$port" ]; then
    echo "::error:: $s — no port mapping"
    return 1
  fi

  local prev=""
  [ -L "$dir/current.jar" ] && prev="$(readlink "$dir/current.jar")"

  echo ">>> $s: switching to $VERSION and restarting"
  ln -sfn "$newjar" "$dir/current.jar"
  if ! sudo systemctl restart "declitech@$s"; then
    echo "::error:: $s — systemctl restart failed"
    [ -n "$prev" ] && [ -f "$prev" ] && ln -sfn "$prev" "$dir/current.jar"
    return 1
  fi

  if wait_listening "$port" && [ "$(systemctl is-active "declitech@$s")" = "active" ]; then
    echo ">>> $s: healthy on $port"
  else
    echo "::error:: $s did not come up on $port within ${HEALTH_TIMEOUT}s"
    if [ -n "$prev" ] && [ -f "$prev" ]; then
      echo ">>> $s: ROLLING BACK to $(basename "$prev")"
      ln -sfn "$prev" "$dir/current.jar"
      sudo systemctl restart "declitech@$s"
      wait_listening "$port" && echo ">>> $s: restored previous version" || echo "::error:: $s rollback also failed"
    fi
    return 1
  fi

  ls -1t "$dir"/*.jar 2>/dev/null | grep -v '/current.jar$' | grep -v "$(basename "$prev")" | tail -n +"$((KEEP + 1))" | xargs -r rm -f
}

echo "Deploying version $VERSION; changed services: [$CHANGED]"

failed=0
for s in $ORDER; do
  case " $CHANGED " in
    *" $s "*) deploy_one "$s" || failed=1 ;;
    *) : ;;
  esac
done

exit "$failed"
