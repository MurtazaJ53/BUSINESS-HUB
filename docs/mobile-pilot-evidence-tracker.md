# Mobile Pilot Evidence Tracker

## Purpose

The Flutter Settings screen now includes an `Evidence tracker` panel so operators can see which rollout exports have already been captured on the device during the current pilot or rollout session.

This avoids a common floor problem:
- someone copies the smoke report
- someone else copies the handoff pack later
- nobody knows what is still missing before shift closeout or rollout approval

## Where it lives

- [D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart](D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart)

## What it tracks

### Core exports

These are the main artifacts expected during a normal pilot flow:

- pilot snapshot
- readiness signoff
- smoke report
- full handoff pack
- shift closeout
- rollout evidence pack

### Optional exports

These are only needed when the situation calls for them:

- recovery report
- incident escalation pack
- operator action brief

## How to use it

1. Open the mobile Settings screen.
2. Watch the `Evidence tracker` panel as operators copy exports.
3. Confirm the missing core list is shrinking as the shift progresses.
4. Copy the tracker block if the rollout lead wants a quick status summary.
5. Reset the tracker only when starting a clearly new rollout or shift evidence session.

## Important behavior

- the tracker updates automatically when the operator uses the built-in copy/export flows
- it is meant for session-level operational awareness, not permanent audit storage
- it does not replace the actual evidence packs; it only shows what has already been captured

## Best use

Use it alongside:

- [D:/business-hub/docs/mobile-launch-operations-runbook.md](D:/business-hub/docs/mobile-launch-operations-runbook.md)
- [D:/business-hub/docs/mobile-pilot-readiness-signoff.md](D:/business-hub/docs/mobile-pilot-readiness-signoff.md)
- [D:/business-hub/docs/mobile-pilot-smoke-sheet.md](D:/business-hub/docs/mobile-pilot-smoke-sheet.md)
- [D:/business-hub/docs/mobile-pilot-shift-closeout.md](D:/business-hub/docs/mobile-pilot-shift-closeout.md)
- [D:/business-hub/docs/mobile-pilot-rollout-evidence-pack.md](D:/business-hub/docs/mobile-pilot-rollout-evidence-pack.md)
