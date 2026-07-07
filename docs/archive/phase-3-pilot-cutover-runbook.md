# Phase 3 Pilot Cutover Runbook

## Purpose

This runbook is the operational guide for completing Phase 3 pilot domain cutovers in Business Hub.

It is the practical companion to:

- [Implementation Roadmap](./implementation-roadmap.md)
- [Firebase to PostgreSQL Migration Plan](./firebase-to-postgres-migration-plan.md)
- [Legacy Client Compatibility Policy](./legacy-client-compatibility-policy.md)

## Goal of Phase 3

Phase 3 is successful when:

- pilot domains can run on PostgreSQL without silent corruption
- operators can observe and triage drift without engineering intervention
- rollback has been tested and is operationally clear
- one or more pilot shops complete the cutover sequence safely

## Pilot domains

Current pilot domains:

- `inventory`
- `customers`

## Required control-plane surfaces

Before running a pilot, the migration console should be available and current for:

- domain controls
- migration jobs
- bridge receipts
- shadow summaries
- pilot readiness
- pilot signoff
- shop scorecards
- shop checkpoint journal
- phase readiness
- phase checkpoint journal
- reconciliation queue

## Preconditions

Do not begin a pilot unless all of the following are true:

- the domain control exists for the pilot shop
- bridge mode is active in the expected direction
- shadow reads are enabled where required
- backfill can be run safely
- compare jobs are executable
- reconciliation queue is visible to operators
- rollback actions are available in the console

## Standard pilot sequence

### Step 1: Select pilot shop

Choose a low-risk shop that has:

- engaged operator/admin support
- moderate but not extreme data volume
- stable connectivity for initial observation
- availability for rollback if needed

### Step 2: Run pilot preparation

For each pilot domain:

1. run `prepare-pilot`
2. confirm backfill succeeded
3. confirm shadow compare succeeded
4. confirm readiness gate updates correctly

Expected result:

- `ready_for_pilot = true`
- no critical drift
- no stale epoch blockers

### Step 3: Review reconciliation

If any mismatches exist:

- acknowledge them
- resolve or reopen based on real operator review
- rerun compare if needed

Do not continue while:

- critical reconciliation items remain open
- stale epoch issues remain unresolved

### Step 4: Promote ready

When the domain is clean enough:

1. trigger `promote-ready`
2. confirm the domain enters the `ready` stage
3. verify the stage strip and checkpoint board update

### Step 5: Promote primary

Only after the ready-stage checkpoint is acceptable:

1. trigger `promote-primary`
2. confirm:
   - write master becomes `postgres`
   - cutover status becomes `postgres_primary`
   - epoch increments
3. confirm write-path enforcement is now active on the new surface

### Step 6: Verify pilot

Immediately after promotion:

1. run `verify-pilot`
2. inspect:
   - mismatch count
   - critical reconciliation count
   - stale epoch count
   - operational verdict

Possible verdicts:

- `production_safe`
- `monitoring`
- `rollback_recommended`

### Step 7: Record shop checkpoint

For the pilot shop, record one of:

- `approved_for_cutover`
- `hold_for_monitoring`
- `rollback_escalated`

This creates the durable shop-level signoff trail.

### Step 8: Review phase readiness

After pilot shops complete the cycle:

- inspect the phase readiness panel
- confirm whether Phase 3 is:
  - `blocked`
  - `monitoring`
  - `ready_for_phase_exit`
  - `rollback_recommended`

### Step 9: Record phase checkpoint

When leadership/operators are satisfied, record one of:

- `approved_for_next_phase`
- `hold_for_monitoring`
- `rollback_escalated`

This is the final durable signoff for the phase.

## Rollback runbook

### Rollback triggers

Rollback should be considered immediately when:

- `verify-pilot` returns `rollback_recommended`
- new critical mismatches appear after primary promotion
- stale epoch pressure reveals unsafe client behavior
- operators report unacceptable workflow failure
- reconciliation drift threatens business trust

### Rollback steps

1. trigger domain `rollback`
2. confirm:
   - write owner returns to `firebase`
   - bridge mode returns to `compare_only`
   - epoch increments again
3. re-run compare to confirm post-rollback posture
4. create or update reconciliation notes
5. record shop checkpoint decision if rollback is escalated
6. update phase checkpoint if rollback changes phase posture

### Rollback success conditions

- legacy write path is restored for the affected domain
- no hidden PostgreSQL-primary writes remain enabled
- operators understand the rollback state
- reconciliation data remains intact for later retry

## Go / no-go decision rules

### Go

Approve a shop when:

- backfill and compare are clean
- no open critical drift exists
- verify-pilot is healthy
- operator review is satisfied

Approve the phase when:

- pilot shops have explicit approved checkpoints
- phase readiness reports `ready_for_phase_exit`
- no rollback pressure remains

### No-go

Hold or rollback when:

- blockers remain unresolved
- monitoring posture is still ambiguous
- operator trust is weak
- stale client behavior is still producing unsafe drift

## Legacy client policy during pilot

During pilot cutovers:

- PostgreSQL-primary domains must not accept legacy writes
- legacy clients may fall back to read-only shadow access where safe
- stale reconnects must generate reviewable events, not overwrite truth

## Evidence to keep

For every pilot run, keep:

- job traces
- compare results
- bridge receipts
- reconciliation actions
- shop checkpoint decisions
- phase checkpoint decisions

## Phase 3 completion checklist

Phase 3 can be considered complete only when:

- at least one real pilot shop has passed the full sequence
- inventory and customers both survive cutover and verification
- rollback has been executed or explicitly simulated and timed
- support/admin can work the reconciliation queue without engineering help
- phase readiness is stable enough for formal signoff
- a phase checkpoint decision has been recorded

## Final runbook verdict

Phase 3 is not finished when the console looks impressive.

Phase 3 is finished when:

- the pilot sequence has been executed end-to-end
- the data remains trustworthy
- operators can manage the process safely
- rollback is genuinely available
