# Mobile Pilot Handoff Pack

## Purpose

This document defines the complete evidence bundle for handing a signed mobile build to a pilot shop.

## What the handoff pack now includes

### From the release workflow

- signed APK
- `.sha256` checksum file
- text manifest
- JSON manifest
- generated handoff markdown
- release tag and pilot scope embedded in all of the above
- smoke execution context tied to the same release tag and pilot scope

Workflow:
- [D:/business-hub/.github/workflows/flutter_mobile_release.yml](D:/business-hub/.github/workflows/flutter_mobile_release.yml)

### From the mobile app

- copied pilot snapshot
- copied smoke report
- copied readiness signoff
- copied full handoff pack
- copied shift closeout report after the real pilot shift
- copied rollout evidence pack for the final wave record when needed
- copied recovery report if a replay issue appears
- copied incident escalation pack when the device crosses into a support/engineering incident

Surface:
- [D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart](D:/business-hub/apps/mobile_flutter/lib/features/settings/presentation/settings_screen.dart)

## Minimum archive set

Before a pilot device is approved, archive:

1. release APK
2. checksum file
3. release manifest text
4. release manifest JSON
5. generated handoff markdown
6. copied pilot snapshot
7. copied smoke report
8. copied readiness signoff
9. copied full handoff pack
10. copied shift closeout report after floor use
11. copied rollout evidence pack when the rollout lead requests one combined operator record
12. copied incident escalation pack if the device entered incident posture

## Why this matters

This makes the pilot traceable from both ends:

- release pipeline evidence proves what was built
- release scope proves who it was built for
- in-app evidence proves what the device was actually seeing at handoff time

## Supporting documents

- [D:/business-hub/docs/mobile-pilot-readiness-signoff.md](D:/business-hub/docs/mobile-pilot-readiness-signoff.md)
- [D:/business-hub/docs/mobile-pilot-smoke-sheet.md](D:/business-hub/docs/mobile-pilot-smoke-sheet.md)
- [D:/business-hub/docs/mobile-pilot-recovery-playbook.md](D:/business-hub/docs/mobile-pilot-recovery-playbook.md)
- [D:/business-hub/docs/mobile-pilot-shift-closeout.md](D:/business-hub/docs/mobile-pilot-shift-closeout.md)
- [D:/business-hub/docs/mobile-pilot-rollout-evidence-pack.md](D:/business-hub/docs/mobile-pilot-rollout-evidence-pack.md)
- [D:/business-hub/docs/mobile-pilot-incident-escalation-pack.md](D:/business-hub/docs/mobile-pilot-incident-escalation-pack.md)
