# Database backup & restore runbook

Everything the business owns — sales, customers, inventory, subscriptions —
lives in one Postgres volume (`bhub_db`) on the Droplet. This is how it is
protected and how to get it back.

## One-time setup (on the Droplet)

```bash
cd /opt/bhub && git pull
chmod +x scripts/*.sh
mkdir -p /var/backups/bhub && chmod 700 /var/backups/bhub

# Prove it works BEFORE trusting it
./scripts/backup_db.sh
./scripts/check_backup.sh

# Nightly backup at 02:00, health check at 07:00
(crontab -l 2>/dev/null; \
 echo "0 2 * * * /opt/bhub/scripts/backup_db.sh >> /var/log/bhub-backup.log 2>&1"; \
 echo "0 7 * * * /opt/bhub/scripts/check_backup.sh >> /var/log/bhub-backup.log 2>&1") | crontab -
crontab -l
```

## What runs

| Script | When | Does |
|---|---|---|
| `backup_db.sh` | 02:00 daily | Verified `pg_dump -Fc`, prunes old copies, writes a success stamp |
| `check_backup.sh` | 07:00 daily | Fails loudly if the newest backup is missing, stale (>30h) or suspiciously small |
| `restore_db.sh` | manually | Restores a dump, after taking a safety dump of current data |

Retention: **14 daily**, **8 weekly** (Sundays). Dumps are `chmod 600` because
they contain customer data.

## Restoring

```bash
# 1. See what you have
ls -lh /var/backups/bhub/daily/

# 2. Check a dump is readable WITHOUT changing anything
./scripts/restore_db.sh --dry-run /var/backups/bhub/daily/bhub-YYYYMMDD-HHMMSS.dump

# 3. Stop writes, restore, bring it back
docker compose -f docker-compose.demo.yml stop api
./scripts/restore_db.sh /var/backups/bhub/daily/bhub-YYYYMMDD-HHMMSS.dump
docker compose -f docker-compose.demo.yml up -d --build
```

The restore takes a **safety dump of the current database first**
(`/var/backups/bhub/pre-restore/`), so a restore of the wrong file is itself
recoverable. It runs in a single transaction: a mid-way failure rolls back
rather than leaving a half-restored database.

## Off-site copies — read this

**Local backups do not survive losing the Droplet.** They sit on the same disk
as the database. To be genuinely safe you need a copy somewhere else.

Cheapest solid option — DigitalOcean Spaces (~$5/month):

```bash
# install + configure once
curl https://rclone.org/install.sh | sudo bash
rclone config          # new remote, type: s3, provider: DigitalOcean

# then add to /opt/bhub/.env.demo
BACKUP_REMOTE=spaces:bhub-backups
```

`backup_db.sh` picks that up automatically and uploads each night. If the
upload fails the run does **not** fail — a good local backup still beats none —
but the log records a warning.

**No-cost stopgap** — pull a copy to your laptop periodically:

```bash
scp root@YOUR_DROPLET_IP:/var/backups/bhub/daily/bhub-*.dump ~/Downloads/
```

## Testing the backup (do this quarterly)

A backup you have never restored is not a backup.

```bash
# Verify the newest dump is readable end to end
./scripts/restore_db.sh --dry-run "$(ls -t /var/backups/bhub/daily/*.dump | head -1)"
```

For a full drill, restore into a throwaway database rather than the live one.

## What is NOT covered

- **Product photos** are stored in the database (`image_data`), so they *are*
  in these dumps.
- The Droplet itself is not imaged. Consider DigitalOcean's weekly Droplet
  backups (20% of Droplet cost) for whole-machine recovery.
- Secrets (`.env.demo`) are **not** in the dump. Keep a copy of that file in a
  password manager — without `DJANGO_SECRET_KEY` and `BLIND_INDEX_PEPPER`,
  restored encrypted fields and phone-hash lookups will not work.
