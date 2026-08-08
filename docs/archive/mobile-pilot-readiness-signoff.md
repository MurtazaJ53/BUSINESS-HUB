# Mobile Pilot Readiness Signoff

## Purpose

This document defines the final mobile device go / no-go check before a pilot operator starts a real shift.

## In-app signoff surface

- [D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart](D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart)

The Settings screen now includes `Pilot readiness signoff`, which evaluates:

- release tag and pilot scope
- release channel and build identity
- signed-in operator state
- workspace binding
- failed receipt count
- recovery desk failures
- queue backlog
- offline / syncing posture
- rollback-recommended migration domains

## Possible verdicts

### 1. `READY FOR SHIFT`

Use when:
- no blocking replay failures exist
- no failed receipts are recorded
- release identity is correct
- the device is operationally clean

### 2. `MONITOR BEFORE SHIFT`

Use when:
- no hard blocker exists
- but queue, sync, or connectivity posture still deserves observation

### 3. `BLOCKED STARTUP`

Use when:
- the build is still marked `local`
- no operator is attached
- no workspace is bound
- failed receipts remain
- the recovery desk still shows failed commerce commands
- a migration domain recommends rollback

## Operator flow

1. Install the intended signed APK.
2. Open `Settings`.
3. Check `Pilot readiness signoff`.
4. If needed, use `Copy readiness signoff`.
5. If the rollout lead needs one combined artifact, use `Copy full handoff pack`.
6. Archive the copied signoff or handoff pack in the rollout log.
7. If the status is `BLOCKED STARTUP`, do not start the shift.
8. If the status is `MONITOR BEFORE SHIFT`, inform the rollout lead and continue only with monitoring awareness.

## Supporting documents

- [D:/business-hub/docs/mobile-pilot-handoff-pack.md](D:/business-hub/docs/mobile-pilot-handoff-pack.md)
- [D:/business-hub/docs/mobile-pilot-smoke-sheet.md](D:/business-hub/docs/mobile-pilot-smoke-sheet.md)
- [D:/business-hub/docs/mobile-pilot-recovery-playbook.md](D:/business-hub/docs/mobile-pilot-recovery-playbook.md)
- [D:/business-hub/docs/mobile-launch-operations-runbook.md](D:/business-hub/docs/mobile-launch-operations-runbook.md)
