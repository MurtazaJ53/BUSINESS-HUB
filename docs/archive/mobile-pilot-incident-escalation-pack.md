# Mobile Pilot Incident Escalation Pack

## Purpose

This document defines the device-side incident export used when a pilot device is no longer in a simple recovery or monitor state.

Use it when support, engineering, or the rollout lead needs one structured escalation record from the affected device.

## In-app surface

Build it from:

- [D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart](D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart)

The `Incident escalation pack` action captures:

- severity
- impact scope
- checkout blocked or not
- money movement risk or not
- rollback requested or not
- copied readiness signoff
- copied launch snapshot
- copied recovery report

## Escalation decisions

### `IMMEDIATE ESCALATION`

Use when:

- checkout is blocked
- money movement accuracy is at risk
- rollback is being requested

### `URGENT REVIEW`

Use when:

- failed recovery items still exist
- blocked readiness posture is still present
- the rollout lead needs urgent engineering review

### `MONITOR WITH SUPPORT`

Use when:

- the device does not require immediate rollback
- but support should still watch the device or shop closely

## Minimum archive set

Archive:

1. copied pilot snapshot
2. copied recovery report
3. copied rollout evidence pack if it exists
4. copied incident escalation pack

## Supporting documents

- [D:/business-hub/docs/mobile-pilot-recovery-playbook.md](D:/business-hub/docs/mobile-pilot-recovery-playbook.md)
- [D:/business-hub/docs/mobile-pilot-rollout-evidence-pack.md](D:/business-hub/docs/mobile-pilot-rollout-evidence-pack.md)
