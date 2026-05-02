# Master Launch and Rollout Checklist

## Purpose

This is the single execution sheet for the final Business Hub rollout path.

Use this file when the team is no longer building migration scaffolding and is
instead executing:

- Phase 5 retirement and hardening
- Phase 6 go-live and hypercare
- Phase 7 live rollout and scale optimization

If the team wants one file to run the platform from launch approval to rollout
completion, use this file.

## Command center

Primary operator surface:

- [Migration Control Page](../apps/admin_web/src/app/migration/page.tsx)

Primary supporting runbooks:

- [Phase 5 Retirement Runbook](./phase-5-retirement-runbook.md)
- [Phase 6 Go-Live Runbook](./phase-6-go-live-runbook.md)
- [Phase 7 Live Rollout Runbook](./phase-7-live-rollout-runbook.md)

## Final program flow

1. Finish retirement posture.
2. Approve launch.
3. Execute go-live.
4. Stay in hypercare until stable.
5. Handoff to steady state.
6. Advance rollout waves.
7. Tune scale if needed.
8. Complete rollout.

## Operator roles

### Release lead

Owns:

- launch approval
- go-live execution decision
- rollout-wave advance/hold decisions

### Reconciliation lead

Owns:

- open mismatch review
- critical drift triage
- rollback recommendation escalation

### Mobile/POS lead

Owns:

- Flutter device checks
- sales replay validation
- payment replay validation
- offline recovery validation

### Operations lead

Owns:

- hypercare monitoring
- incident coordination
- steady-state handoff acceptance
- scale tuning decisions

## Phase 5 checklist: retirement and hardening

### Preconditions

- required domains are present:
  - `inventory`
  - `customers`
  - `customer_ledger`
  - `expenses`
  - `attendance`
  - `sales`
  - `payments`
  - `stock_ledger`
  - `reporting`

### Must be true before launch approval

- all required domains are `postgres_primary`
- no required domain is still `firebase` write-master
- no critical reconciliation event is open for required domains
- bridge replay is disabled or quarantine-only
- mobile/web/backend parity review is done
- rollback ownership is assigned

### Required operator actions

1. Review retirement readiness board.
2. Review shop retirement scorecards.
3. Confirm required-domain posture is clean.
4. Confirm reconciliation is clear.
5. Record one launch checkpoint:
   - `approved_for_launch`
   - `hold_for_hardening`
   - `rollback_to_phase4`

### Stop immediately if

- any required domain is still Firebase-primary
- critical ledger drift exists
- hidden legacy write path is found

## Phase 6 checklist: go-live and hypercare

### Preconditions

- latest launch checkpoint is `approved_for_launch`
- go-live readiness shows `ready_for_go_live`
- rollback operators are available
- smoke-test staff are ready on mobile and web

### Go-live window checklist

1. Record `execute_go_live`.
2. Run smoke checks:
   - login
   - inventory read/write
   - customer read/write
   - sale creation
   - payment replay
   - dashboard refresh
3. Watch:
   - reconciliation events
   - stale epoch events
   - bridge receipts
   - projection freshness
   - operator complaints

### Hypercare checklist

During hypercare, verify:

- no unresolved critical reconciliation issues accumulate
- POS command replay remains healthy
- payment replay remains healthy
- rollback pressure remains zero

### Allowed decisions during Phase 6

- `execute_go_live`
- `remain_in_hypercare`
- `handoff_to_steady_state`
- `rollback_launch`

### Handoff conditions

Only record `handoff_to_steady_state` when:

- hypercare window is complete
- rollback pressure is zero
- no critical launch issue remains open
- operations accepts the platform

## Phase 7 checklist: live rollout and scale optimization

### Preconditions

- latest go-live checkpoint is `handoff_to_steady_state`
- rollout readiness is at least `wave_ready`
- the next shop wave is selected
- rollback ownership exists for that wave

### Rollout-wave checklist

1. Record `advance_rollout_wave`.
2. Onboard the selected wave of shops.
3. Watch:
   - reconciliation drift
   - POS replay health
   - dashboard freshness
   - support incident volume
4. If needed, record:
   - `hold_rollout_wave`
   - `scale_tuning_active`
   - `rollback_shop_wave`
5. When the rollout target is met, record `complete_rollout`.

### Scale tuning triggers

Move to `scale_tuning_active` when:

- queue latency grows materially
- projections lag enough to reduce operator trust
- read pressure begins to justify cache/replica changes
- support noise rises because the platform feels slow

### Completion conditions

Only record `complete_rollout` when:

- the planned rollout footprint is fully onboarded
- rollback pressure is zero
- scale-tuning work is acceptable
- operations accepts the expanded footprint

## Live decision matrix

### If status is `blocked`

- do not advance
- clear the blocker first

### If status is `monitoring`

- keep the current phase active
- do not promote blindly

### If status is `rollback_recommended`

- stop advancement
- start rollback review immediately

### If status is `ready_for_launch`

- Phase 5 can approve launch

### If status is `ready_for_go_live`

- Phase 6 can execute go-live

### If status is `hypercare_active`

- keep watching
- do not hand off early

### If status is `steady_state`

- Phase 7 can begin rollout waves

### If status is `wave_ready`

- next rollout wave can start

### If status is `rollout_active`

- keep the current wave under watch

### If status is `scale_tuning`

- optimize before further expansion if needed

### If status is `completed`

- rollout program is done

## Evidence to capture

For each major decision, capture:

- timestamp
- actor
- shop or wave scope
- current board status
- reason for approval/hold/rollback
- links to any incidents or reconciliation items

This evidence should come from the migration control plane journals, not from memory.

## Suggested daily operating rhythm during rollout

### Start of day

1. review retirement/go-live/rollout boards
2. review new critical reconciliation items
3. review mobile replay and payment health

### Midday

1. confirm rollout wave posture
2. confirm no new rollback signals
3. review scale-tuning indicators if active

### End of day

1. record any hold/advance/rollback decisions
2. update shop/wave status
3. leave next-step notes for the next operator shift

## Master go/no-go rule

Do not move forward just because the code exists.

Move forward only when:

- the control plane is green enough,
- the operator evidence is clear enough,
- and the rollback path is still real.

## Final completion rule

The Business Hub transition is only truly complete when:

- retirement is finished,
- launch is executed,
- hypercare is closed,
- rollout waves are completed,
- and the platform is operating normally at the target footprint.
