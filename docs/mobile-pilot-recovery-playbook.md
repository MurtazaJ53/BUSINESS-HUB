# Mobile Pilot Recovery Playbook

## Purpose

This playbook explains what to do when a pilot device starts showing queued or failed commerce replay during a real shop session.

## Use this when

- receipts stay queued longer than expected
- a receipt shows a backend replay failure
- support asks for a structured device-side incident report
- the rollout lead needs to decide whether the device can stay in pilot

## Recovery desk location

- [D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart](D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart)

The mobile Settings screen now includes a `Recovery desk` panel that shows:

- top queued / syncing / failed commerce commands
- command type and customer context
- retry per receipt
- retry all attention items
- copyable recovery report

## Recommended operator flow

1. Open `Settings`.
2. Confirm the build identity is the intended release.
3. Open `Recovery desk`.
4. If only one receipt is affected:
   - use `Retry this receipt`
5. If several receipts are affected:
   - use `Retry all attention items`
6. If failure remains:
   - use `Copy recovery report`
   - paste it into the rollout/support thread
7. Record whether the issue blocks checkout or only delayed replay.

## Escalation rule

Escalate immediately if:

- repeated retry still fails
- the same receipt keeps returning to `FAILED`
- multiple receipts fail across more than one operator device
- customer ledger or payment state looks wrong after retry

## Rollback rule

Rollback the pilot device or stop rollout for that shop if:

- queued receipts keep growing during normal connectivity
- replay failure affects money movement accuracy
- the copied recovery report shows repeated failures across multiple commands

## Evidence to capture

- copied pilot snapshot
- copied recovery report
- release tag / version / short SHA
- APK checksum
- screenshot of the Recovery desk if needed
