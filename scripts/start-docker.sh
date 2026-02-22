#!/bin/sh
set -e

if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please open Docker Desktop and try again." >&2
  exit 1
fi

if [ "$(docker compose ps -q postgres 2>/dev/null)" = "" ]; then
  echo "Starting Postgres container..."
  docker compose up -d
  sleep 3
else
  echo "Postgres container already running."
fi
