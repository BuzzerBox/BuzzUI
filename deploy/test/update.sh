#!/bin/sh
# Pulls the latest test images and recreates only the containers whose image changed.
# Note: restarting the server ends a running game, since it keeps the game state in memory.
set -e
cd "$(dirname "$0")"
docker compose pull --quiet
docker compose up -d --remove-orphans
docker image prune -f > /dev/null
