#!/bin/sh
set -e

if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please open Docker Desktop and try again." >&2
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -q '^sai-explorer-db$'; then
  echo "Postgres container already running."
elif docker ps -a --format '{{.Names}}' | grep -q '^sai-explorer-db$'; then
  echo "Starting existing Postgres container..."
  docker start sai-explorer-db
  sleep 3
else
  echo "Starting Postgres container..."
  docker compose up -d
  sleep 3
fi
