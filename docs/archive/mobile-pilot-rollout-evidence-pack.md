# Mobile Pilot Rollout Evidence Pack

## Purpose

This document defines the final consolidated operator export for a pilot device after the supporting reports already exist.

Use it when a rollout lead wants one copied pack that references:

- launch snapshot
- readiness signoff
- recovery posture
- smoke result summary
- shift closeout summary
- current wave recommendation

## In-app surface

Build it from:

- [D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart](D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart)

The `Rollout evidence pack` action lets the operator summarize:

- smoke verdict
- smoke notes
- shift closeout decision
- shift closeout notes
- rollout recommendation
- rollout lead notes

## Recommendations

### `ADVANCE WAVE`

Use when:

- smoke passed cleanly
- shift closeout was healthy
- no meaningful replay or recovery concern is still active

### `HOLD CURRENT WAVE`

Use when:

- the device can keep operating
- but the rollout lead wants one more monitored cycle before advancing

### `ROLLBACK CURRENT WAVE`

Use when:

- smoke was blocked
- shift closeout escalated
- or the rollout lead wants to freeze or reverse the current wave

### `MANUAL REVIEW`

Use when:

- the device evidence is mixed
- the rollout lead wants an explicit human review before deciding

## Minimum evidence chain

Archive:

1. copied pilot snapshot
2. copied readiness signoff
3. copied smoke report
4. copied recovery report if any replay trouble occurred
5. copied shift closeout report
6. copied rollout evidence pack

## Supporting documents

- [D:/business-hub/docs/mobile-pilot-handoff-pack.md](D:/business-hub/docs/mobile-pilot-handoff-pack.md)
- [D:/business-hub/docs/mobile-pilot-smoke-sheet.md](D:/business-hub/docs/mobile-pilot-smoke-sheet.md)
- [D:/business-hub/docs/mobile-pilot-shift-closeout.md](D:/business-hub/docs/mobile-pilot-shift-closeout.md)
