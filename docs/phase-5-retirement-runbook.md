# Phase 5 Retirement and Hardening Runbook

## Purpose

This runbook defines the final operating posture for Business Hub after the migration phases have reached code-complete cutover.

It covers:

- final launch approval
- Firebase retirement posture
- steady-state hardening expectations
- rollback triggers back to Phase 4 posture

## Core rule

Phase 5 is not about inventing new write paths.

It is about proving that:

- core domains already run on PostgreSQL
- Firebase is no longer the operational truth for required domains
- bridge traffic is only quarantine/archive pressure, not active production dependency
- launch signoff is explicit and durable

## Required Phase 5 domains

The retirement gate evaluates these domains:

- `inventory`
- `customers`
- `customer_ledger`
- `expenses`
- `attendance`
- `sales`
- `payments`
- `stock_ledger`
- `reporting`

## Retirement readiness statuses

### `blocked`

Use when:

- required domain controls are missing
- a required domain is still Firebase-primary
- a required domain has not reached `postgres_primary`

### `monitoring`

Use when:

- required domains are on PostgreSQL
- but compare-only bridge pressure still exists
- or open reconciliation issues still need observation

### `ready_for_launch`

Use when:

- all required domains are `postgres_primary`
- no required domain is Firebase-primary
- no active bridge replay direction is still required
- no open reconciliation pressure remains on required domains

### `retirement_complete`

Use when:

- launch readiness is already clean
- and a final launch checkpoint explicitly approved the platform

### `rollback_recommended`

Use when:

- critical reconciliation pressure appears on required domains
- or the platform must fall back to the Phase 4 commerce posture

## Launch checkpoint decisions

Phase 5 records durable launch decisions:

- `approved_for_launch`
- `hold_for_hardening`
- `rollback_to_phase4`

These decisions are not inferred from dashboards alone. They must be written into the migration control plane.

## Firebase retirement policy

Firebase should end Phase 5 in one of these states:

- `archive_only`
- `bridge_source_only`
- `fully_retired`

It must not remain an untracked silent fallback for core domain writes.

## Operational checks before final launch

1. all required domains are `postgres_primary`
2. no required domain remains Firebase-primary
3. no critical reconciliation events remain open for required domains
4. bridge replay is disabled or strictly quarantined
5. mobile/web/backend parity has already been reviewed
6. rollback-to-phase-4 instructions are assigned and tested
7. launch checkpoint is explicitly recorded

## Rollback triggers back to Phase 4

Phase 5 should roll back to Phase 4 posture when any of the following appear:

- new critical financial reconciliation drift
- unexpected Firebase-primary dependency on a required domain
- hidden legacy write path discovered during launch review
- mobile/web/backend parity breaks under real pilot load
- cutover dashboards disagree with ledger truth

## Minimum operator checklist

1. review Phase 5 retirement readiness board
2. inspect required-domain scorecards for every active shop
3. confirm no Firebase-primary required domains remain
4. confirm no critical reconciliation issues remain
5. confirm bridge posture is quarantine-safe
6. record `approved_for_launch`, `hold_for_hardening`, or `rollback_to_phase4`
7. monitor first steady-state operations window

## Final rule

If the platform still needs Firebase as an invisible production crutch for required domains, Phase 5 is not complete.
