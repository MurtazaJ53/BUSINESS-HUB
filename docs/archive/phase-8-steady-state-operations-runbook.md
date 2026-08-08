# Phase 8 Steady-State Operations Runbook

## Purpose

This runbook defines how Business Hub should be operated after rollout is complete.

Phase 8 is not another migration phase.

It is the normal long-term operating mode for:

- reliability
- support
- scaling
- cost control
- safe product evolution

## Entry conditions

Phase 8 starts only after all of the following are true:

- rollout is marked complete
- the platform is operating in steady state
- rollback pressure is not active
- operations has accepted ownership of the expanded footprint

## Core operating loops

### Daily

- review production health
- review critical incidents
- review reconciliation alerts
- review commerce replay health

### Weekly

- review support pain points
- review slow endpoints and queue pressure
- review dashboard/projection freshness
- review backlog of operational fixes

### Monthly

- review SLO performance
- review error-budget consumption
- review cloud cost movement
- review capacity headroom
- review dependency and security update posture

### Quarterly

- review architecture fit
- review scaling assumptions
- review new product demands against the target platform
- review whether any Tier B investment should start

## SLO guidance

At minimum, track:

- API availability
- admin surface usability
- POS replay success rate
- reconciliation critical-event rate
- projection freshness
- queue delay

If these are not visible, Phase 8 is not healthy no matter how stable the code feels.

## Incident discipline

Every meaningful incident should result in:

- a written incident summary
- root-cause classification
- action items
- owner and due date

Do not normalize repeated incidents just because the rollout is already complete.

## Cost discipline

Review cost across:

- database
- workers
- cache
- storage
- bandwidth
- monitoring stack

If costs rise, the first question is:

- is this because the business grew,
- or because the architecture is being used inefficiently?

## Product evolution rule

All new features must follow the new platform rules:

- PostgreSQL remains source of truth
- no hidden Firebase-style write shortcuts
- idempotency stays intact
- auditability stays intact
- derived projections are not treated as write truth

If a feature proposal violates those rules, it needs architecture review before implementation.

## When to invest beyond Tier A

Only start heavier investments when evidence shows the need, such as:

- read pressure consistently justifying replicas
- worker throughput becoming a bottleneck
- cache pressure becoming persistent
- regional latency materially harming operators
- reporting load threatening transactional health

## Anti-regression rule

Do not let steady-state work quietly undo the migration discipline.

That means:

- no silent legacy bypasses
- no untracked fallback write paths
- no direct client truth for financial facts
- no undocumented operational shortcuts

## Final rule

Phase 8 is successful when Business Hub is not just live, but:

- reliable,
- understandable,
- supportable,
- cost-aware,
- and safe to evolve.

## Supporting references

- [SLO and Error Budget Review Cadence](./slo-and-error-budget-review-cadence.md)
- [Incident and Postmortem Cadence](./incident-and-postmortem-cadence.md)
- [Cost and Capacity Review Cadence](./cost-and-capacity-review-cadence.md)
- [Dependency Upgrade Policy](./dependency-upgrade-policy.md)
- [Phase 8 Quarterly Architecture Review Checklist](./phase-8-quarterly-architecture-review-checklist.md)
