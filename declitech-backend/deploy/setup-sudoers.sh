#!/usr/bin/env bash
set -e

F=/etc/sudoers.d/hamdi-declitech
SERVICES="eureka-server gateway-service auth-service user-service module-service session-service report-service"
ACTIONS="start stop restart enable disable is-active"

{
  echo 'hamdi ALL=(ALL) NOPASSWD: /usr/bin/systemctl daemon-reload'
  echo 'hamdi ALL=(ALL) NOPASSWD: /usr/sbin/nginx'
  echo 'hamdi ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx'
  for s in $SERVICES; do
    for a in $ACTIONS; do
      echo "hamdi ALL=(ALL) NOPASSWD: /usr/bin/systemctl $a declitech@$s"
    done
  done
} > "$F"

chmod 440 "$F"
echo "wrote $(grep -c . "$F") rules to $F"
