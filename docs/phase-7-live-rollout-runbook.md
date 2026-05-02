# Phase 7 Live Rollout Runbook

## Purpose

This runbook governs what happens after the first launch footprint is stable.

Phase 7 is about:

- expanding to more shops in waves
- pausing or holding rollout safely
- tuning scale while traffic grows
- recording final rollout completion

## Preconditions

Before Phase 7 starts, all of the following should already be true:

- Phase 6 is in `steady_state`
- the latest go-live checkpoint is `handoff_to_steady_state`
- rollback ownership is assigned for new rollout waves
- support and operations can see migration, reconciliation, and commerce surfaces

## Phase 7 statuses

The rollout readiness board can report:

- `blocked`
- `wave_ready`
- `rollout_active`
- `scale_tuning`
- `completed`
- `rollback_recommended`

### Blocked

The platform is not yet allowed to expand further.

Typical causes:
- steady-state handoff has not happened yet
- go-live rollback pressure still exists
- critical reconciliation pressure reopened

### Wave ready

The platform is stable enough to start the next rollout wave.

Typical operator action:
- record `advance_rollout_wave`

### Rollout active

The platform is currently expanding to a new batch of shops or operators.

Typical operator actions:
- continue the wave
- hold the wave if support pressure rises
- watch hypercare-style signals for each new batch

### Scale tuning

The rollout is live, but the team is deliberately tuning:

- queues
- workers
- cache posture
- projections
- read/load behavior

### Completed

The rollout program is complete and the planned expansion has finished.

### Rollback recommended

The current rollout wave should be paused or reversed until the affected shops are stable again.

## Rollout checkpoint decisions

The control plane records one of the following:

- `advance_rollout_wave`
- `hold_rollout_wave`
- `scale_tuning_active`
- `complete_rollout`
- `rollback_shop_wave`

## Minimum rollout-wave checklist

1. Confirm Phase 6 is already in `steady_state`.
2. Confirm no rollback pressure exists in the go-live board.
3. Record `advance_rollout_wave`.
4. Onboard the next wave of shops.
5. Watch:
   - reconciliation drift
   - POS replay health
   - dashboard freshness
   - operator incident volume
6. If needed, record:
   - `hold_rollout_wave`
   - `scale_tuning_active`
   - `rollback_shop_wave`
7. When expansion goals are met, record `complete_rollout`.

## Scale tuning triggers

Move into `scale_tuning_active` when any of the following become true:

- queue latency grows noticeably
- projection refresh delays impact operator trust
- read traffic begins to justify stronger caching or replicas
- support noise rises because the platform feels slow under load

## Rollback triggers

Rollout should be held or reversed if:

- new shops show critical reconciliation drift
- rollback signals appear on migrated commerce domains
- queue or replay failures threaten financial trust
- operator workflows degrade during the new wave

## Completion rule

Do not record `complete_rollout` until:

- the planned rollout footprint is fully onboarded
- rollback pressure is zero
- tuning work is either complete or accepted into normal ops
- operations explicitly accepts the expanded footprint

## Final rule

Phase 7 is complete only when the platform is not just launched, but:

- expanded,
- tuned,
- and operationally normal at the new footprint.
