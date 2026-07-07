# Phase 6 Go-Live Runbook

## Purpose

This runbook defines the last operational stage after retirement and launch approval.

Phase 6 is where Business Hub stops being "approved for launch" on paper and is
actually operated through:

- the launch execution window
- the hypercare monitoring period
- the final handoff into steady-state operations

## Preconditions

Before Phase 6 starts, all of the following should already be true:

- Phase 5 retirement readiness is no worse than `ready_for_launch`
- the latest launch checkpoint is `approved_for_launch`
- rollback ownership is assigned
- reconciliation operators are on-call
- the Flutter POS command replay path is enabled for the pilot commerce domains

## Phase 6 statuses

The go-live readiness board can report:

- `blocked`
- `ready_for_go_live`
- `hypercare_active`
- `steady_state`
- `rollback_recommended`

### Blocked

The platform is not yet allowed to enter the launch window.

Typical causes:
- launch approval missing
- retirement blockers reopened
- unresolved critical reconciliation pressure

### Ready for go-live

The platform is approved for launch and ready to enter the execution window.

Typical operator action:
- record `execute_go_live`

### Hypercare active

The platform is live, but still under elevated watch.

Typical operator actions:
- keep monitoring
- record `remain_in_hypercare` if more observation time is needed
- record `handoff_to_steady_state` only after the stability window is complete

### Steady state

The launch window is complete and the platform has been formally handed off to normal operations.

### Rollback recommended

The launch window should be reversed or stopped until drift, reconciliation, or operator-impact issues are resolved.

## Go-live checkpoint decisions

The control plane records one of the following:

- `execute_go_live`
- `remain_in_hypercare`
- `handoff_to_steady_state`
- `rollback_launch`

## Minimum launch-day checklist

1. Confirm retirement readiness is still green.
2. Confirm the latest launch checkpoint is `approved_for_launch`.
3. Record `execute_go_live`.
4. Run mobile and web smoke checks:
   - login
   - inventory read/write
   - customer read/write
   - POS sale creation
   - payment replay
   - dashboard projection refresh
5. Watch reconciliation and bridge surfaces for new critical events.
6. Keep hypercare active until the agreed monitoring window expires.
7. Record either:
   - `remain_in_hypercare`
   - `handoff_to_steady_state`
   - `rollback_launch`

## Hypercare expectations

During hypercare:

- no unresolved critical reconciliation events should accumulate
- rollback-recommended domains or shops should be escalated immediately
- POS command replay failures should be triaged in real time
- dashboard and projection freshness should be monitored continuously

## Rollback triggers

Rollback should be considered if any of the following appear during the go-live window:

- critical reconciliation drift in migrated domains
- stale epoch rejections rising unexpectedly
- POS command replay failures that threaten financial trust
- launch-time data loss suspicion
- operator-facing workflows becoming unreliable

## Steady-state handoff rule

Do not record `handoff_to_steady_state` until:

- the hypercare window is complete
- no critical launch issues remain open
- rollback pressure is zero
- operations ownership has explicitly accepted the handoff

## Final rule

Phase 6 is complete only when Business Hub is not merely launch-approved, but:

- launched,
- monitored,
- and explicitly handed off into steady-state operation.
