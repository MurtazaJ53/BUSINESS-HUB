# Mobile Launch Operations Runbook

## Purpose

This runbook defines how to prepare, build, verify, and distribute a Flutter mobile release for pilot shops or wider rollout.

## Release identity

The Flutter app now exposes build metadata inside Settings:

- app name
- package name
- version + build number
- release channel
- short release SHA when provided at build time

Operators should verify those values on-device before pilot distribution.
The Settings screen also now provides a copyable pilot launch snapshot for release tickets and rollout threads.

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
   - release SHA
10. Use `Copy pilot snapshot` and archive the output in the rollout record.
11. Run device smoke checks.
12. Distribute to pilot shops only after smoke pass.

## Pilot smoke focus

Reference sheet:
- [D:/business-hub/docs/mobile-pilot-readiness-signoff.md](D:/business-hub/docs/mobile-pilot-readiness-signoff.md)
- [D:/business-hub/docs/mobile-pilot-smoke-sheet.md](D:/business-hub/docs/mobile-pilot-smoke-sheet.md)
- [D:/business-hub/docs/mobile-pilot-recovery-playbook.md](D:/business-hub/docs/mobile-pilot-recovery-playbook.md)

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
