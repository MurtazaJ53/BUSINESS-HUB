# Mobile Pilot Shift Closeout

## Purpose

This document defines the final operator report that should be captured at the end of a real pilot shift.

It answers a different question than launch readiness:

- readiness asks whether the device is safe to start
- shift closeout asks how the device actually finished

## In-app surface

Run the closeout from:

- [D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart](D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart)

The Settings screen now includes `Shift closeout`, which produces a copyable report with:

- release fingerprint
- release tag
- pilot scope
- workspace and operator identity
- sync posture
- queued commerce commands
- failed receipts
- end-of-shift health answers
- final closeout decision

## Closeout questions

The operator should confirm:

- checkout stayed stable through the shift
- replay and outbox behavior stayed stable after reconnects
- customer ledger and due-balance behavior stayed correct
- rollback is or is not required before the next shift

## Closeout decisions

### `HEALTHY HANDOFF`

Use when:

- checkout stayed stable
- replay stayed stable
- customer ledger stayed stable
- no rollback is required
- no meaningful replay work is left behind

### `MONITOR NEXT SHIFT`

Use when:

- the device can keep running
- but queue work, offline posture, or minor warnings need monitoring

### `ESCALATE INCIDENT`

Use when:

- rollback is required
- checkout became unstable
- replay became unstable
- failed recovery items still exist

## Minimum archive set after a real shift

Archive:

1. copied pilot snapshot
2. copied smoke report
3. copied readiness signoff
4. copied recovery report if any retry/recovery work was needed
5. copied shift closeout report

## Supporting documents

- [D:/business-hub/docs/mobile-launch-operations-runbook.md](D:/business-hub/docs/mobile-launch-operations-runbook.md)
- [D:/business-hub/docs/mobile-pilot-smoke-sheet.md](D:/business-hub/docs/mobile-pilot-smoke-sheet.md)
- [D:/business-hub/docs/mobile-pilot-recovery-playbook.md](D:/business-hub/docs/mobile-pilot-recovery-playbook.md)
