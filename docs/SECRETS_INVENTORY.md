# Secrets inventory — what to back up, and what breaks if you lose it

None of these live in the database, so **a perfect database backup plus a lost
secret still equals data loss**. Keep a copy of everything below in a password
manager (Bitwarden / 1Password / KeePass), not in this repo and not only on the
Droplet.

Source of truth on the server: `/opt/bhub/.env.demo`

```bash
# View it (run on the Droplet)
cat /opt/bhub/.env.demo
```

## The two that are unrecoverable

| Secret | If you lose it |
|---|---|
| `SECRET_KEY` (`DJANGO_SECRET_KEY`) | **Encrypted database columns become permanently unreadable.** Customer phone/email fields are encrypted with a key derived from this. A restored backup would be structurally fine and semantically ruined. Also invalidates every JWT, logging everyone out. |
| `BLIND_INDEX_PEPPER` | Defaults to `SECRET_KEY` if unset. Customer **phone-number search stops matching** — existing phone hashes were computed with the old value and can never be recomputed. |

> Changing either of these on a database that already has data is a one-way
> door. Never "regenerate" them to tidy things up.

## The rest

| Secret | Impact if lost | Recoverable? |
|---|---|---|
| `POSTGRES_PASSWORD` | Can't connect to the database container | Yes — reset it and update the env file |
| `POSTGRES_USER` / `POSTGRES_DB` | Restore targets the wrong database | Yes — they're names, not secrets |
| `RESEND_API_KEY` | Invite / notification emails stop sending | Yes — issue a new key at resend.com |
| `ENSURE_PLATFORM_ADMIN_PASSWORD` | Can't sign in as platform admin | Yes — reset via `manage.py` |
| `RAZORPAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET` | Subscription payments stop; billing falls back to "payment not enabled" | Yes — regenerate in the Razorpay dashboard |

## Files that are NOT in the database or in git

| File | Where it should live | If lost |
|---|---|---|
| `/opt/bhub/.env.demo` | Password manager (paste the whole file) | See above |
| `business-hub-upload.jks` + its password | Password manager / encrypted backup | **You can never update the Play Store app** until Play App Signing is enrolled. After enrolment Google can reset a lost upload key. |
| `service-account.json` | Delete it — Firebase is dormant (see SECURITY_ROTATION_AND_HISTORY_PURGE.md) | Nothing; it should be revoked anyway |

## Do this now (5 minutes)

1. `cat /opt/bhub/.env.demo` on the Droplet.
2. Create a **Secure Note** in your password manager called
   "Business Hub — production env" and paste the whole file.
3. Add a second entry for the keystore: the `.jks` file as an attachment plus
   its password and alias (`businesshub`).
4. Record the upload-key fingerprint alongside it, so you can confirm a build
   was signed with the right key:
   `SHA-256 D3:C3:7A:49:51:32:A7:B0:17:15:A9:8E:8A:F3:6F:C3:F5:26:90:24:9E:B0:4D:34:43:3A:D1:BA:C9:A3:19:CD`

## Verify your backup is actually complete

A backup is only real once you can answer yes to all three:

- [ ] The nightly dump runs and `check_backup.sh` reports OK
- [ ] At least one dump exists **off** the Droplet
- [ ] `.env.demo` is stored somewhere other than the Droplet

Two out of three is not a backup.
