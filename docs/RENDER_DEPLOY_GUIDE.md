# Deploy the Business Hub backend on Render (free) — step by step

A complete, beginner-friendly guide to putting `apps/backend` (Django + DRF) on
[Render](https://render.com) for free. Written 2026-07-24.

> **What "free" gets you and its limits — read first**
> - The web service **sleeps after ~15 min idle**; the next request wakes it in ~30–50s. Fine for testing/demo, not production traffic.
> - Render's **free PostgreSQL expires after 90 days**. For something longer-lived, use [Neon](https://neon.tech) free Postgres instead (Step 3, Option B).
> - **No Redis** on free tier. That's handled: `USE_INMEMORY_CHANNELS=true` runs background tasks in-process. Core POS + sync do **not** need Redis; only async projections/ERPNext sync pause.

The code side is already prepared for you: `apps/backend/build.sh`, `apps/backend/render.yaml`, WhiteNoise for static files, and gunicorn are in place. You just do the dashboard steps below.

---

## Before you start — a 2-minute prerequisite

Your 11 fixes are on the `feat/universal-import` branch. Render deploys from a branch, so either:
- **Deploy from `feat/universal-import`** (pick it in Step 4), or
- **Merge to `main` first** and deploy from `main`.

Either works. Just note which branch you'll point Render at.

---

## Step 1 — Create a Render account

1. Go to **https://render.com** → **Get Started**.
2. Sign up with **GitHub** (easiest — it lets Render see your repos).
3. Verify your email if prompted.

## Step 2 — Connect your GitHub repository

1. In the Render dashboard, click your profile → **Account Settings → GitHub** (or you'll be prompted on first service creation).
2. Click **Configure** / **Install Render** on GitHub.
3. Grant access to the **`MurtazaJ53/BUSINESS-HUB`** repository (you can allow just this one repo).

## Step 3 — Create the PostgreSQL database

### Option A — Render's own free Postgres (simplest)
1. Dashboard → **New +** → **Postgres**.
2. Name: `business-hub-db`. Region: pick the closest to you.
3. Plan: **Free**. Click **Create Database**.
4. Wait ~1 min until status is **Available**.
5. Open the database → find **Connection** → copy the **Internal Database URL** (starts with `postgres://…`). You'll paste it in Step 5.
   - Use the **Internal** URL if the web service is in the same Render region (faster, no egress). Use the **External** URL only for connecting from your laptop.

### Option B — Neon (free, does NOT expire in 90 days)
1. Go to **https://neon.tech** → sign up (GitHub).
2. Create a project → it gives you a **connection string** like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`.
3. Copy that string — it's your `DATABASE_URL`.

> Either way you end up with one **DATABASE_URL** string. Keep it handy.

## Step 4 — Create the Web Service

1. Dashboard → **New +** → **Web Service**.
2. Pick your **BUSINESS-HUB** repo → **Connect**.
3. Fill the form:

| Field | Value |
|-------|-------|
| **Name** | `business-hub-api` |
| **Region** | same as your DB |
| **Branch** | `feat/universal-import` (or `main` if you merged) |
| **Root Directory** | `apps/backend` |
| **Runtime** | Python 3 |
| **Build Command** | `./build.sh` |
| **Start Command** | `gunicorn config.wsgi:application -c gunicorn.conf.py` |
| **Instance Type** | **Free** |

4. **Don't deploy yet** — click **Advanced** and add the environment variables in Step 5 first.

## Step 5 — Set environment variables

Under **Environment** (during creation, or later in the service's **Environment** tab), add these:

| Key | Value | Notes |
|-----|-------|-------|
| `DJANGO_SECRET_KEY` | *(click "Generate" or paste a long random string)* | Never reuse the dev value |
| `DJANGO_DEBUG` | `0` | Production mode |
| `DATABASE_URL` | *(the string from Step 3)* | Render can auto-fill this if you use its DB — see tip below |
| `DATABASE_SSL_REQUIRED` | `true` | Both Render and Neon require SSL |
| `DJANGO_ALLOWED_HOSTS` | `business-hub-api.onrender.com` | **You'll know the exact host after the first deploy** — set a placeholder now, then update (Step 7) |
| `USE_INMEMORY_CHANNELS` | `true` | No Redis on free tier → tasks run in-process |
| `PYTHON_VERSION` | `3.13.4` | Match your local Python 3.13 |

> **Tip (Render DB only):** instead of pasting `DATABASE_URL`, click **Add from Database** and select `business-hub-db` → property `Connection String`. Render keeps it wired automatically.

To generate a secret key locally if you prefer:
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Step 6 — Deploy

1. Click **Create Web Service**.
2. Watch the **Logs**. `build.sh` will: install deps → `collectstatic` → `migrate`. Then gunicorn starts.
3. First build takes ~3–6 min. Success looks like `Booting worker` / `Listening at: http://0.0.0.0:10000` and the status turns **Live**.
4. Your URL appears at the top: something like **`https://business-hub-api.onrender.com`**.

## Step 7 — Fix ALLOWED_HOSTS and verify

1. Copy your real `*.onrender.com` host from the top of the service page.
2. Go to **Environment** → set `DJANGO_ALLOWED_HOSTS` to exactly that host (no `https://`, no trailing slash), e.g. `business-hub-api.onrender.com`.
3. Save → Render auto-redeploys (~1 min).
4. **Test it:** open `https://business-hub-api.onrender.com/api/v1/` in a browser. A JSON response (or DRF page) = success. (First hit may take ~40s if it was asleep.)

## Step 8 — Load demo data (optional but recommended)

So the API returns real content:
1. Service page → **Shell** tab (free tier includes a shell).
2. Run:
   ```bash
   python manage.py seed_demo
   ```
3. It prints a shop id, owner login, and sample counts — the same demo workspace you used locally.

---

## Step 9 — Point the mobile app at Render (to go truly end-to-end)

Rebuild the APK with the Render URL as the API base:

```bash
flutter build apk --release \
  --dart-define BUSINESS_HUB_API_BASE_URL=https://business-hub-api.onrender.com/api/v1 \
  --dart-define BUSINESS_HUB_UPI_VPA=demomart@okhdfcbank \
  --dart-define BUSINESS_HUB_MANAGER_PIN=4821
```

> **Auth caveat (important).** The mobile app currently signs in with **Firebase**. For the Render backend to accept those tokens it needs the Firebase **service-account** as a secret. So the honest end-to-end path is:
> 1. **Rotate** the leaked Firebase service-account key in the Firebase console (you were doing this anyway).
> 2. Add its JSON to Render as a secret file / env var (the backend reads `service-account.json`).
> 3. Then the rebuilt APK talks to Render for real.
>
> Until then, the **API itself is live and testable** (browser, curl, the DRF pages) — only the *authenticated mobile round-trip* waits on the Firebase step. I can walk you through the service-account secret when you're ready.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Build fails at `pip install` | Check `PYTHON_VERSION=3.13.4` is set; read the log for the failing package |
| `DisallowedHost` error | `DJANGO_ALLOWED_HOSTS` doesn't match the real host — set it exactly (Step 7) |
| `ImproperlyConfigured: DJANGO_SECRET_KEY is not set` | You set `DJANGO_DEBUG=0` without a secret — add `DJANGO_SECRET_KEY` |
| 500 on every request | Usually DB — confirm `DATABASE_URL` + `DATABASE_SSL_REQUIRED=true`; check the migrate step ran |
| First request very slow | Normal on free tier (service was asleep ~15 min) — it wakes in ~30–50s |
| Static/admin pages unstyled | `collectstatic` didn't run — check `build.sh` logs; WhiteNoise is already configured |
| Celery/Redis connection errors | Ensure `USE_INMEMORY_CHANNELS=true` is set |

## What was prepared for you (already committed)
- `apps/backend/build.sh` — install + collectstatic + migrate
- `apps/backend/render.yaml` — optional blueprint (Step-by-step above is the manual path)
- `requirements.txt` — added `gunicorn` + `whitenoise`
- `config/settings.py` — WhiteNoise middleware + static storage (verified: boots with `DEBUG=0`, 157 static files collected)

## Still on your side
- Rotate the leaked Firebase key (also needed for the mobile auth round-trip)
- Back up `business-hub-release.jks` off-machine
- Decide branch to deploy (`feat/universal-import` vs merge to `main` first)
