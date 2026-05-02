# Mobile Operator Action Center

## Purpose

This document defines the top-level on-device recommendation layer for pilot operations.

The goal is simple:

- operators should not have to guess which tool to open next
- rollout leads should get a consistent next-step recommendation from the device itself

## In-app surface

Available in:

- [D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart](D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart)

The `Operator action center` evaluates:

- readiness posture
- recovery posture
- queued commerce commands
- failed receipts
- signed-in operator and workspace binding

## Action outcomes

### `Build incident escalation pack`

Shown when:

- readiness is blocked
- failed receipts exist
- failed recovery commands exist

### `Use recovery desk`

Shown when:

- queued or syncing commerce commands still need attention
- the device is offline, syncing, or otherwise not operationally clean

### `Run smoke checklist`

Shown when:

- operator and workspace identity are present
- queue and recovery posture are clean enough for active floor validation

### `Copy pilot snapshot`

Shown when:

- baseline identity capture is still the most useful next step

## Supporting documents

- [D:/business-hub/docs/mobile-launch-operations-runbook.md](D:/business-hub/docs/mobile-launch-operations-runbook.md)
- [D:/business-hub/docs/mobile-pilot-recovery-playbook.md](D:/business-hub/docs/mobile-pilot-recovery-playbook.md)
- [D:/business-hub/docs/mobile-pilot-incident-escalation-pack.md](D:/business-hub/docs/mobile-pilot-incident-escalation-pack.md)
