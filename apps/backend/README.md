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
- `/api/v1/shops/<shop_id>/domain-state/<domain>/`
- `/api/v1/shops/<shop_id>/inventory/`
- `/api/v1/shops/<shop_id>/customers/`
- `/api/v1/shops/<shop_id>/customers/<customer_id>/ledger/`
- `/api/v1/shops/<shop_id>/expenses/`
- `/api/v1/shops/<shop_id>/attendance/`
- `/api/v1/shops/<shop_id>/sales/`
- `/api/v1/shops/<shop_id>/sales/commands/`
- `/api/v1/shops/<shop_id>/payments/`
- `/api/v1/shops/<shop_id>/payments/commands/`
- `/api/v1/shops/<shop_id>/projections/dashboard/`
- `/api/v1/migration/domains/`
- `/api/v1/migration/jobs/`
- `/api/v1/migration/bridge-receipts/`
- `/api/v1/migration/pilot-readiness/`
- `/api/v1/migration/phase-readiness/`
- `/api/v1/migration/phase-checkpoints/`
- `/api/v1/migration/retirement-readiness/`
- `/api/v1/migration/launch-checkpoints/`
- `/api/v1/migration/go-live-readiness/`
- `/api/v1/migration/go-live-checkpoints/`
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
Use `/api/v1/migration/pilot-readiness/`, `/api/v1/migration/domains/<control_id>/prepare-pilot/`, `/api/v1/migration/domains/<control_id>/promote-ready/`, `/api/v1/migration/domains/<control_id>/promote-primary/`, `/api/v1/migration/domains/<control_id>/verify-pilot/`, and `/api/v1/migration/domains/<control_id>/rollback/` to assess and control Phase 3 inventory/customer pilots.
`prepare-pilot` can run the backfill + shadow-compare sequence in one step, and `?run_inline=1` makes that sequence executable immediately for local/admin-driven pilot preparation.
`verify-pilot` runs a fresh compare against the promoted or ready domain and reports whether the pilot is healthy or whether rollback should be considered.
When a migration control exists for `inventory`, Django inventory mutations are allowed only after that domain is `postgres_primary`; otherwise the API returns a `409` so the legacy write owner is not bypassed accidentally.
Use `/api/v1/shops/<shop_id>/domain-state/inventory/` from shop-scoped surfaces to show whether the current shop is still in legacy/shadow mode or has actually been promoted to PostgreSQL-primary.
Use `/api/v1/migration/phase-readiness/` and `/api/v1/migration/phase-checkpoints/` for the final Phase 3 program-level exit gate and durable phase signoff trail.

## Phase 4 commerce command flow

Phase 4 introduces command-style commerce ingestion on the PostgreSQL path:

- `/api/v1/shops/<shop_id>/sales/commands/`
- `/api/v1/shops/<shop_id>/payments/commands/`

These endpoints add:

- idempotent command receipts per shop
- base-domain-epoch checks for stale POS replay rejection
- migration ownership guards for `sales`, `payments`, `stock_ledger`, and `customer_ledger` where applicable
- projection refresh after accepted commerce writes so dashboards stay derived from committed facts

If a sales or payments migration control exists and that domain is still legacy-owned, the command endpoint returns `409` instead of bypassing the active write owner.

## Phase 5 retirement and launch signoff

Phase 5 adds the final retirement/hardening control plane:

- `/api/v1/migration/retirement-readiness/`
- `/api/v1/migration/launch-checkpoints/`

The retirement readiness endpoint rolls up whether required domains are still Firebase-primary, still using bridge pressure, or are actually ready for final launch.
The launch checkpoint endpoint records durable final decisions:

- `approved_for_launch`
- `hold_for_hardening`
- `rollback_to_phase4`

## Phase 6 go-live and hypercare signoff

Phase 6 adds the final execution control plane:

- `/api/v1/migration/go-live-readiness/`
- `/api/v1/migration/go-live-checkpoints/`

The go-live readiness endpoint answers whether the platform is:

- `blocked`
- `ready_for_go_live`
- `hypercare_active`
- `steady_state`
- `rollback_recommended`

The go-live checkpoint endpoint records durable launch-window decisions:

- `execute_go_live`
- `remain_in_hypercare`
- `handoff_to_steady_state`
- `rollback_launch`
