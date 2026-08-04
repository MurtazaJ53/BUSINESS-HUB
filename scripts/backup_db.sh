#!/usr/bin/env bash
#
# Nightly Postgres backup for the Business Hub demo/production Droplet.
#
#   ./scripts/backup_db.sh
#
# Writes a verified, compressed dump to $BACKUP_DIR, prunes old copies, and
# leaves a stamp file that check_backup.sh watches so a silent failure gets
# noticed. Safe to run by hand at any time.
#
# Cron (2 AM daily):
#   0 2 * * * /opt/bhub/scripts/backup_db.sh >> /var/log/bhub-backup.log 2>&1
#
set -Eeuo pipefail

# Dumps contain customer data — never let them be world-readable.
umask 077

PROJECT_DIR="${PROJECT_DIR:-/opt/bhub}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.demo.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.demo}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/bhub}"
DAILY_KEEP="${DAILY_KEEP:-14}"
WEEKLY_KEEP="${WEEKLY_KEEP:-8}"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

trap 'fail "backup aborted on line $LINENO"' ERR

cd "$PROJECT_DIR" || fail "project dir $PROJECT_DIR not found"

# Credentials live in the compose env file; never hardcode them here.
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
PG_USER="${POSTGRES_USER:-bhub}"
PG_DB="${POSTGRES_DB:-business_hub}"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

STAMP="$(date '+%Y%m%d-%H%M%S')"
OUT="$BACKUP_DIR/daily/bhub-$STAMP.dump"
TMP="$OUT.partial"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

log "starting backup of database '$PG_DB'"

# Refuse to write a dump from a database that isn't accepting connections —
# otherwise a failed container quietly produces an empty "backup".
compose exec -T db pg_isready -U "$PG_USER" >/dev/null 2>&1 \
  || fail "database is not ready; refusing to write a bogus backup"

# -Fc  custom format: compressed, and supports selective/parallel restore.
# nice/ionice keep the dump from starving the API or the other site on this box.
if ! nice -n 10 ionice -c2 -n7 \
     compose exec -T db pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner > "$TMP"; then
  rm -f "$TMP"
  fail "pg_dump failed"
fi

# An empty or truncated file is worse than no file, because it looks like a
# backup. Verify by actually reading the archive's table of contents back.
if [[ ! -s "$TMP" ]]; then
  rm -f "$TMP"
  fail "dump is empty"
fi
if ! compose exec -T db pg_restore --list < "$TMP" >/dev/null 2>&1; then
  # Keep the file rather than delete it: the verification step could itself be
  # at fault, and throwing away a possibly-good backup is worse than keeping a
  # suspect one. The success stamp is NOT written, so check_backup.sh alerts.
  mv "$TMP" "$OUT.suspect"
  fail "dump failed verification — kept as $OUT.suspect for inspection"
fi

mv "$TMP" "$OUT"
chmod 600 "$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"
log "wrote and verified $OUT ($SIZE)"

# Keep one dump per week for longer-term recovery (e.g. corruption noticed late).
if [[ "$(date '+%u')" == "7" ]]; then
  cp -p "$OUT" "$BACKUP_DIR/weekly/bhub-$STAMP.dump"
  log "kept a weekly copy"
fi

# Retention. -print so the log shows exactly what was removed.
find "$BACKUP_DIR/daily" -name 'bhub-*.dump' -type f -mtime "+$DAILY_KEEP" -print -delete \
  | sed 's/^/  pruned daily: /' || true
find "$BACKUP_DIR/weekly" -name 'bhub-*.dump' -type f -mtime "+$((WEEKLY_KEEP * 7))" -print -delete \
  | sed 's/^/  pruned weekly: /' || true

# Optional off-site copy. Local backups do NOT survive losing the Droplet, so
# set BACKUP_REMOTE (an rclone target such as "spaces:bhub-backups") to get a
# real second copy. Left unset, the backup is local-only.
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    if rclone copy "$OUT" "$BACKUP_REMOTE" --no-traverse 2>&1 | sed 's/^/  rclone: /'; then
      log "uploaded off-site to $BACKUP_REMOTE"
    else
      # Don't fail the whole run: a good local backup still beats none.
      log "WARNING: off-site upload failed — backup exists locally only"
    fi
  else
    log "WARNING: BACKUP_REMOTE is set but rclone is not installed"
  fi
fi

# Success stamp for the staleness check.
date '+%s' > "$BACKUP_DIR/.last_success"
log "backup complete"
