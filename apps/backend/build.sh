#!/usr/bin/env bash
# Render build script for the Business Hub backend.
# Runs on every deploy: install deps, collect static files, apply migrations.
set -o errexit   # stop on first error

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input
