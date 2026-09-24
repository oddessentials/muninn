#!/bin/sh
set -eu
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${BACKUP_DIR:-/backups}"
  chown app:app "${BACKUP_DIR:-/backups}"
  if [ -n "${PLUGIN_EXPORT_DIR:-}" ]; then
    mkdir -p "${PLUGIN_EXPORT_DIR}"
    chown app:app "${PLUGIN_EXPORT_DIR}"
  fi
  exec su-exec app sh "$0" "$@"
fi
node src/lib/server/db/migrate.ts
exec node build
