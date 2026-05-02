# Mobile Launch Operations Runbook

## Purpose

This runbook defines how to prepare, build, verify, and distribute a Flutter mobile release for pilot shops or wider rollout.

## Release identity

The Flutter app now exposes build metadata inside Settings:

- app name
- package name
- version + build number
- release channel
- release tag
- pilot scope
- short release SHA when provided at build time

Operators should verify those values on-device before pilot distribution.
The Settings screen also now provides a copyable pilot launch snapshot for release tickets and rollout threads.
It also now provides an operator action center that recommends the next operational move from the device itself.
It also supports an end-of-shift closeout report so the next operator or rollout lead can see how the device actually finished.
It also supports a final rollout evidence pack so the rollout lead can archive one combined operator record for the wave.
It also supports an incident escalation pack when rollout support needs a direct device-side failure export.
It also now includes an evidence tracker so the device can show which rollout exports have already been captured and which core artifacts are still missing.
That evidence tracker now persists across app restarts on the same workspace, so shift handoff is less fragile on shared devices.
It now also supports named evidence sessions so operators can separate one shift or rollout wave from the next.
It now also keeps a short archive of recent completed evidence sessions so the previous shift summary is still available after a fresh session starts.
It now also supports archive export and archive reset controls so stale shared-device history can be managed without deleting the active session.
It now also summarizes recent archive health so a rollout lead can see whether the last few shifts are trending clean or still closing with missing evidence.
It now also provides a rollout decision summary so the device can state whether the current posture supports expansion, monitoring, investigation, or rollback.
It now also provides wave closeout readiness so the device can state whether the current wave record is actually complete enough to close.
It now also provides a wave signoff pack so the final device-side handoff can be archived as one explicit closeout package.
It now also provides a wave archive pack so final signoff and recent evidence-session history can be preserved together in the permanent rollout archive.

## Version source

Primary version source:
- [D:/business-hub/apps/mobile_flutter/pubspec.yaml](D:/business-hub/apps/mobile_flutter/pubspec.yaml)

Format:
- `marketing_version+build_number`
- example: `1.3.8+8`

## Release lanes

### 1. Validation lane

Workflow:
- [D:/business-hub/.github/workflows/flutter_mobile_validate.yml](D:/business-hub/.github/workflows/flutter_mobile_validate.yml)

Use for:
- every mobile PR
- every `main` push affecting Flutter mobile

### 2. Release lane

Workflow:
- [D:/business-hub/.github/workflows/flutter_mobile_release.yml](D:/business-hub/.github/workflows/flutter_mobile_release.yml)

Local runner:
- [D:/business-hub/scripts/mobile_flutter_release.ps1](D:/business-hub/scripts/mobile_flutter_release.ps1)
- [D:/business-hub/docs/mobile-local-release-runner.md](D:/business-hub/docs/mobile-local-release-runner.md)

Triggers:
- push tag matching `mobile-v*`
- manual `workflow_dispatch`

Build metadata injected:
- `BUSINESS_HUB_RELEASE_CHANNEL`
- `BUSINESS_HUB_RELEASE_SHA`

Release artifacts now include:
- signed release APK
- `.sha256` checksum file
- release manifest with tag, channel, SHA, and checksum
- JSON manifest
- generated pilot handoff markdown

Local release packaging mirrors that artifact shape under:
- `release-artifacts/mobile-local/<release-tag>/`

Signing path:
- GitHub workflow expects Android signing secrets
- Flutter Android release now uses a real release signing config when keystore values are present
- local template: [D:/business-hub/apps/mobile_flutter/android/key.properties.example](D:/business-hub/apps/mobile_flutter/android/key.properties.example)

## Recommended release sequence

1. Bump version in `pubspec.yaml`.
2. Fill [D:/business-hub/docs/mobile-release-notes-template.md](D:/business-hub/docs/mobile-release-notes-template.md).
3. Complete [D:/business-hub/docs/mobile-release-readiness-checklist.md](D:/business-hub/docs/mobile-release-readiness-checklist.md).
4. Run / confirm validation workflow green.
5. Create release tag:
   - example: `mobile-v1.3.9`
6. Let the release workflow build and publish the APK.
7. Install the APK on at least one real operator device.
8. Verify the APK checksum against the workflow output.
9. Open Settings and verify:
   - version
   - release channel
   - pilot scope
   - release SHA
10. Use `Copy pilot snapshot` and archive the output in the rollout record.
11. Run `Run smoke checklist` from the device and archive the copied smoke report.
12. Run any remaining manual device smoke checks.
13. Distribute to pilot shops only after smoke pass.
14. At the end of the pilot shift, run `Shift closeout` and archive the copied report.
15. If the rollout lead needs a single combined pack, run `Build evidence pack` and archive that output too.
16. If the device enters an incident posture, run `Build escalation pack` and attach it to the support thread.
17. Use `Copy evidence tracker` before final handoff if the rollout lead wants one quick summary of which core artifacts were already captured on-device.
18. Use `Copy archive insights` when you want the recent archived-session trend without pasting the full archive pack.
19. Use `Copy decision summary` when the rollout lead wants one short wave verdict that combines current readiness, next action, and archive trend.
20. Use `Copy wave closeout readiness` before closing the wave record so the handoff explicitly states whether closeout is ready, monitor-only, evidence-incomplete, or blocked.
21. Use `Copy wave signoff pack` as the final device-side closeout artifact when the rollout lead wants one last signed-off handoff package for the wave archive.
22. Use `Copy wave archive pack` when you want the permanent rollout record to include both final signoff and recent evidence-session archive history in one export.

## Pilot smoke focus

Reference sheet:
- [D:/business-hub/docs/mobile-pilot-handoff-pack.md](D:/business-hub/docs/mobile-pilot-handoff-pack.md)
- [D:/business-hub/docs/mobile-pilot-readiness-signoff.md](D:/business-hub/docs/mobile-pilot-readiness-signoff.md)
- [D:/business-hub/docs/mobile-pilot-smoke-sheet.md](D:/business-hub/docs/mobile-pilot-smoke-sheet.md)
- [D:/business-hub/docs/mobile-pilot-recovery-playbook.md](D:/business-hub/docs/mobile-pilot-recovery-playbook.md)
- [D:/business-hub/docs/mobile-pilot-shift-closeout.md](D:/business-hub/docs/mobile-pilot-shift-closeout.md)
- [D:/business-hub/docs/mobile-pilot-rollout-evidence-pack.md](D:/business-hub/docs/mobile-pilot-rollout-evidence-pack.md)
- [D:/business-hub/docs/mobile-pilot-incident-escalation-pack.md](D:/business-hub/docs/mobile-pilot-incident-escalation-pack.md)
- [D:/business-hub/docs/mobile-operator-action-center.md](D:/business-hub/docs/mobile-operator-action-center.md)
- [D:/business-hub/docs/mobile-pilot-evidence-tracker.md](D:/business-hub/docs/mobile-pilot-evidence-tracker.md)
- [D:/business-hub/docs/mobile-pilot-evidence-persistence.md](D:/business-hub/docs/mobile-pilot-evidence-persistence.md)
- [D:/business-hub/docs/mobile-pilot-evidence-sessions.md](D:/business-hub/docs/mobile-pilot-evidence-sessions.md)
- [D:/business-hub/docs/mobile-pilot-evidence-session-history.md](D:/business-hub/docs/mobile-pilot-evidence-session-history.md)
- [D:/business-hub/docs/mobile-pilot-evidence-archive-control.md](D:/business-hub/docs/mobile-pilot-evidence-archive-control.md)
- [D:/business-hub/docs/mobile-pilot-evidence-archive-insights.md](D:/business-hub/docs/mobile-pilot-evidence-archive-insights.md)
- [D:/business-hub/docs/mobile-pilot-rollout-decision-summary.md](D:/business-hub/docs/mobile-pilot-rollout-decision-summary.md)
- [D:/business-hub/docs/mobile-pilot-wave-closeout-readiness.md](D:/business-hub/docs/mobile-pilot-wave-closeout-readiness.md)
- [D:/business-hub/docs/mobile-pilot-wave-signoff-pack.md](D:/business-hub/docs/mobile-pilot-wave-signoff-pack.md)
- [D:/business-hub/docs/mobile-pilot-wave-archive-pack.md](D:/business-hub/docs/mobile-pilot-wave-archive-pack.md)

1. login
2. inventory lookup
3. scanner flow
4. POS cash sale
5. split payment sale
6. due/credit sale
7. customer ledger payment
8. history payment mix and receipt detail
9. settings runtime/build identity
10. queued outbox replay after reconnect

## Rollback rule

If the released APK fails smoke or pilot checks:
- stop rollout
- reference the previous stable APK from release notes
- redeploy the older version
- record the rollback reason
- if replay or queue health is the issue, archive the in-app recovery report before rollback

## Important note

Current Flutter mobile release automation builds a release APK from the Flutter project lane. It improves repeatability, but real go-live still depends on pilot-device validation and rollout control.
