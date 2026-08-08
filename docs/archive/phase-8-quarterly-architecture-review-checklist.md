# Phase 8 Quarterly Architecture Review Checklist

## Purpose

This checklist is used during steady-state operations to confirm that Business
Hub is still aligned with the approved target architecture.

## Review questions

### Product fit

- are new features still following the approved domain boundaries?
- did any new workflow reintroduce Firebase-style shortcut behavior?
- are projections still derived, not treated as write truth?

### Reliability

- are SLOs being met?
- are incidents decreasing, flat, or rising?
- are repeated incidents producing real fixes?

### Data integrity

- are reconciliation alerts rare and explainable?
- are idempotent write rules still being respected?
- are any teams bypassing command-based or audited write paths?

### Performance

- is API latency acceptable for operators?
- is POS replay health stable?
- are queue delays growing?
- are projections refreshing on time?

### Cost and capacity

- is database cost rising faster than business growth?
- is worker cost justified by throughput?
- is cache usage effective?
- do we need replicas yet, or are we just guessing?

### Technical health

- are dependencies being upgraded on schedule?
- are migrations staying disciplined and reversible?
- is observability still useful, or has it become noisy and ignored?

## Architecture change triggers

Escalate for architecture review if:

- reporting load threatens transactional health
- regional latency is hurting operators materially
- worker throughput becomes a sustained bottleneck
- rollout complexity creates unmanageable operational drag
- product requirements no longer fit the current modular monolith cleanly

## Output

Each quarterly review should end with:

- keep current architecture as-is
- schedule Tier B investment
- schedule cleanup and simplification work
- block a proposed product feature until architecture review is complete

## Final rule

Quarterly architecture review is not a ceremony.

It exists to stop the platform from drifting quietly away from the design that
made the migration safe in the first place.
