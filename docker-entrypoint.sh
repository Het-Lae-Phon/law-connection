#!/bin/sh
# Seed the database volume on first boot from a published snapshot.
set -e
mkdir -p /data
if [ ! -f /data/dev.db ]; then
  if [ -n "$DB_SNAPSHOT_URL" ]; then
    echo "first boot: downloading database snapshot..."
    curl -L --fail -o /tmp/dev.db.gz "$DB_SNAPSHOT_URL"
    gunzip -c /tmp/dev.db.gz > /data/dev.db
    rm -f /tmp/dev.db.gz
    echo "database ready: $(du -sh /data/dev.db | cut -f1)"
  else
    echo "WARNING: /data/dev.db missing and DB_SNAPSHOT_URL not set — queries will fail."
    echo "Set DB_SNAPSHOT_URL to the .gz snapshot asset URL from GitHub Releases."
  fi
fi
exec "$@"
