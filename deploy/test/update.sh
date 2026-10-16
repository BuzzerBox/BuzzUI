#!/bin/sh
# Pulls the latest test images and recreates only the containers whose image changed.
# It also takes the Caddyfile and docker-compose.yml from main, so new routes reach the host without copying them.
# Note: restarting the server ends a running game, since it keeps the game state in memory.
set -e
cd "$(dirname "$0")"

REPO_RAW_URL="${REPO_RAW_URL:-https://raw.githubusercontent.com/BuzzerBox/BuzzUI/main/deploy/test}"
caddyfile_changed=false
for file in Caddyfile docker-compose.yml; do
  if curl -fsSL "$REPO_RAW_URL/$file" -o "$file.new" && [ -s "$file.new" ]; then
    if ! cmp -s "$file.new" "$file"; then
      # overwrite in place: the Caddyfile is bind-mounted as a single file, which a rename would detach
      cat "$file.new" > "$file"
      echo "$(date -Is) updated $file"
      [ "$file" = Caddyfile ] && caddyfile_changed=true
    fi
  else
    echo "$(date -Is) could not fetch $file, keeping the current one"
  fi
  rm -f "$file.new"
done

docker compose pull --quiet
docker compose up -d --remove-orphans
if [ "$caddyfile_changed" = true ]; then
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
fi
docker image prune -f > /dev/null
