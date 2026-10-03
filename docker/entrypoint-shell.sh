#!/bin/sh
# Writes the runtime config the shell fetches on load. URLs are resolved by the
# browser, so they must be browser-reachable, never docker service names.
set -eu

cat > /usr/share/nginx/html/config.json <<EOF
{
  "remotes": {
    "people": "${PEOPLE_REMOTE_URL}",
    "delivery": "${DELIVERY_REMOTE_URL}"
  }
}
EOF
