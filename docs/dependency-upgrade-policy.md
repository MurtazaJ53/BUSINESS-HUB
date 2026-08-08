# Dependency Upgrade Policy

## Purpose

This document defines how Business Hub should handle dependency upgrades in
steady-state operations.

The goal is to keep the platform secure and maintainable without turning normal
operations into upgrade chaos.

## Rules

- security fixes take priority over convenience deferrals
- major-version upgrades require explicit review
- dependency upgrades should be small and regular, not rare and painful
- every upgrade batch must have an owner
- rollback instructions must exist before production rollout for risky upgrades

## Cadence

### Weekly

- review newly published security advisories
- review critical package warnings from CI

### Monthly

- group safe patch/minor upgrades for:
  - Django and DRF
  - Next.js and React
  - Flutter/Dart packages
  - Redis/Celery support libraries
  - observability tooling

### Quarterly

- review major-version candidates
- decide whether to adopt, defer, or replace aging dependencies

## Upgrade classes

### Patch updates

- default posture: adopt quickly
- require smoke verification

### Minor updates

- default posture: adopt in planned batches
- require targeted regression checks

### Major updates

- require explicit architecture review
- require rollout plan
- require rollback plan

## Required checks before merge

- backend tests pass
- admin lint/build pass
- Flutter analyze/build pass
- release notes reviewed for breaking changes
- config or env changes documented

## Red flags

Do not merge blindly when:

- auth/session behavior changes
- ORM or migration behavior changes
- serialization behavior changes
- worker retry semantics change
- mobile local database packages require schema changes

## Final rule

Business Hub should prefer:

- predictable upgrade cadence
- small reviewable change sets
- documented risk
- reversible rollout

over:

- large emergency catch-up upgrades.
