#!/usr/bin/env bash
# Render build script for the Business Hub backend.
# Runs on every deploy: install deps, collect static files, apply migrations.
set -o errexit   # stop on first error

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input

# One-time demo data seed, only when SEED_DEMO=true. Set that env var, deploy
# once, then remove it so future deploys don't re-run it. (Render free tier has
# no shell, so we seed via the build instead.)
if [ "${SEED_DEMO:-}" = "true" ]; then
  echo "SEED_DEMO=true -> seeding demo data"
  python manage.py seed_demo
fi
