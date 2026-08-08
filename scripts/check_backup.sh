#!/usr/bin/env bash
#
# Alert if the database hasn't been backed up recently.
#
# The classic backup failure is silent: cron breaks, nobody notices for months,
# and the gap is only discovered when a restore is needed. Run this a few hours
# after the nightly job.
#
# Cron (7 AM daily):
#   0 7 * * * /opt/bhub/scripts/check_backup.sh >> /var/log/bhub-backup.log 2>&1
#
# Exit codes: 0 healthy, 1 stale/missing (so any monitor can pick it up).
#
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/bhub}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-30}"   # a little over a day, to allow slippage
MIN_BYTES="${MIN_BYTES:-10240}"        # a valid dump is never this small

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

STAMP_FILE="$BACKUP_DIR/.last_success"
if [[ ! -f "$STAMP_FILE" ]]; then
  log "CRITICAL: no successful backup has ever been recorded ($STAMP_FILE missing)"
  exit 1
fi

NOW="$(date '+%s')"
LAST="$(cat "$STAMP_FILE" 2>/dev/null || echo 0)"
AGE_H=$(( (NOW - LAST) / 3600 ))

if (( AGE_H > MAX_AGE_HOURS )); then
  log "CRITICAL: last successful backup was ${AGE_H}h ago (limit ${MAX_AGE_HOURS}h)"
  exit 1
fi

LATEST="$(find "$BACKUP_DIR/daily" -name 'bhub-*.dump' -type f -printf '%T@ %p\n' 2>/dev/null \
          | sort -rn | head -1 | cut -d' ' -f2-)"
if [[ -z "$LATEST" ]]; then
  log "CRITICAL: the stamp says a backup succeeded but no dump file exists"
  exit 1
fi

SIZE="$(stat -c '%s' "$LATEST")"
if (( SIZE < MIN_BYTES )); then
  log "CRITICAL: newest backup $LATEST is only ${SIZE} bytes — almost certainly broken"
  exit 1
fi

COUNT="$(find "$BACKUP_DIR/daily" -name 'bhub-*.dump' -type f | wc -l)"
log "OK: last backup ${AGE_H}h ago, $(du -h "$LATEST" | cut -f1), $COUNT daily copies retained"
exit 0
