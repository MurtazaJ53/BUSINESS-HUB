# Business Hub Backend

Phase 1 backend foundation for the Business Hub target platform.

## Stack

- Django
- Django REST Framework
- PostgreSQL (target source of truth)
- Redis
- Celery
- OpenTelemetry

## Quick start

1. Create or activate the local virtual environment.
2. Install dependencies:
   - `python -m pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and adjust values as needed.
4. Run migrations:
   - `python manage.py migrate`
5. Start the API:
   - `python manage.py runserver`

## Useful endpoints

- `/api/v1/`
- `/api/v1/session/`
- `/api/v1/shops/`
- `/api/v1/shops/<shop_id>/inventory/`
- `/api/v1/shops/<shop_id>/customers/`
- `/api/v1/shops/<shop_id>/customers/<customer_id>/ledger/`
- `/api/v1/shops/<shop_id>/expenses/`
- `/api/v1/shops/<shop_id>/attendance/`
- `/api/v1/shops/<shop_id>/projections/dashboard/`
- `/api/v1/migration/domains/`
- `/api/v1/migration/jobs/`
- `/api/v1/migration/bridge-receipts/`
- `/api/v1/migration/shadow-summaries/`
- `/api/v1/migration/reconciliation/`
- `/api/v1/health/`
- `/api/v1/health/ready/`
- `/admin/`

## Local auth options

- Session/basic auth for Django admin and direct API use
- Firebase bearer token auth when Firebase credentials are configured
- `X-Dev-User-Email` header fallback in debug mode for local API development

## Local infrastructure

Use `docker-compose.yml` to run PostgreSQL and Redis for the Tier A local stack.

## Phase 2 migration execution

For local Phase 2 testing, migration jobs can be created and executed inline without a running worker by posting to:

- `/api/v1/migration/jobs/?run_inline=1`

The current executable pilot slice supports:

- `inventory` `backfill`
- `inventory` `shadow_compare`
- `inventory` `bridge_replay`
- `customers` `backfill`
- `customers` `shadow_compare`
- `customers` `bridge_replay`
- `reporting` `projection_refresh`

Pass a Firebase-like payload snapshot in `payload_json.source_snapshot` to exercise the pipeline locally.
Use `payload_json.bridge_event` to exercise the unidirectional Firebase-to-PostgreSQL replay path.
Use `/api/v1/migration/bridge-receipts/` and `/api/v1/migration/shadow-summaries/` to inspect replay health and compare posture from the admin control plane.
