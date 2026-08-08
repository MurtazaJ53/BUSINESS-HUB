# Business Hub Deployment and Release Runbook

## Purpose

This document defines how Business Hub should be released and deployed in its current hybrid state.

## Deployment surfaces

### Web/admin

Target:
- Firebase Hosting

Artifacts:
- `dist/`

### Flutter mobile beta

Target:
- APK distribution for internal or beta testing

Artifacts:
- `apps/mobile_flutter/build/app/outputs/flutter-apk/app-release.apk`
- copied release artifact under `release-artifacts/`

## Pre-release checklist

### Web/admin

1. Build passes
2. Tests pass
3. Firebase hosting config is correct
4. CSP / wasm / cache headers remain correct
5. Auth and Firestore flows are healthy

### Flutter mobile

1. `flutter analyze` passes
2. dedicated mobile CI workflow passes
3. release APK build passes
4. owner login tested
5. staff login tested

Preferred local runner:

- [D:/business-hub/scripts/mobile_flutter_validate.ps1](D:/business-hub/scripts/mobile_flutter_validate.ps1)
- [D:/business-hub/docs/mobile-local-validation-runner.md](D:/business-hub/docs/mobile-local-validation-runner.md)
- [D:/business-hub/scripts/mobile_flutter_release_prep.ps1](D:/business-hub/scripts/mobile_flutter_release_prep.ps1)
- [D:/business-hub/docs/mobile-local-release-prep-runner.md](D:/business-hub/docs/mobile-local-release-prep-runner.md)
- [D:/business-hub/scripts/mobile_flutter_release.ps1](D:/business-hub/scripts/mobile_flutter_release.ps1)
- [D:/business-hub/docs/mobile-local-release-runner.md](D:/business-hub/docs/mobile-local-release-runner.md)
- [D:/business-hub/scripts/mobile_flutter_release_bundle.ps1](D:/business-hub/scripts/mobile_flutter_release_bundle.ps1)
- [D:/business-hub/docs/mobile-local-release-bundle-runner.md](D:/business-hub/docs/mobile-local-release-bundle-runner.md)
- [D:/business-hub/scripts/mobile_flutter_release_registry.ps1](D:/business-hub/scripts/mobile_flutter_release_registry.ps1)
- [D:/business-hub/docs/mobile-local-release-registry-runner.md](D:/business-hub/docs/mobile-local-release-registry-runner.md)
- [D:/business-hub/scripts/mobile_flutter_release_tag.ps1](D:/business-hub/scripts/mobile_flutter_release_tag.ps1)
- [D:/business-hub/docs/mobile-local-release-tag-runner.md](D:/business-hub/docs/mobile-local-release-tag-runner.md)
- [D:/business-hub/scripts/mobile_flutter_release_handoff.ps1](D:/business-hub/scripts/mobile_flutter_release_handoff.ps1)
- [D:/business-hub/docs/mobile-local-release-handoff-runner.md](D:/business-hub/docs/mobile-local-release-handoff-runner.md)
- [D:/business-hub/scripts/mobile_flutter_release_pipeline.ps1](D:/business-hub/scripts/mobile_flutter_release_pipeline.ps1)
- [D:/business-hub/docs/mobile-local-release-pipeline-runner.md](D:/business-hub/docs/mobile-local-release-pipeline-runner.md)
6. dashboard/inventory/POS smoke tested
7. mobile sync smoke tested

## Release types

### 1. Web production release

Use when:
- web/admin updates are ready
- hosting deployment is safe

### 2. Flutter internal beta

Use when:
- mobile changes are ready for controlled testing
- app is not yet final production replacement

### 3. Full mobile cutover

Use only when:
- parity criteria are met
- multi-device sync is proven
- production signing/release flow is finalized

## Current recommendation

As of now:
- web/admin can continue normal production deployment
- Flutter mobile should be treated as beta/internal unless parity and sync validation are completed

## Release workflow

### Web/admin

1. merge tested code to main
2. run CI
3. verify hosting deployment
4. verify live smoke flows:
   - login
   - dashboard
   - inventory
   - POS

### Flutter mobile beta

1. prepare release version/tag/notes with [D:/business-hub/scripts/mobile_flutter_release_prep.ps1](D:/business-hub/scripts/mobile_flutter_release_prep.ps1)
2. build release APK
3. if packaging locally, run [D:/business-hub/scripts/mobile_flutter_release.ps1](D:/business-hub/scripts/mobile_flutter_release.ps1) in this order:
   - `-Doctor`
   - `-PreflightOnly`
   - full release run
4. consolidate prep and local outputs with [D:/business-hub/scripts/mobile_flutter_release_bundle.ps1](D:/business-hub/scripts/mobile_flutter_release_bundle.ps1)
5. regenerate the shared mobile release registry with [D:/business-hub/scripts/mobile_flutter_release_registry.ps1](D:/business-hub/scripts/mobile_flutter_release_registry.ps1)
6. run the release tag gate with [D:/business-hub/scripts/mobile_flutter_release_tag.ps1](D:/business-hub/scripts/mobile_flutter_release_tag.ps1)
7. build the final portable handoff pack with [D:/business-hub/scripts/mobile_flutter_release_handoff.ps1](D:/business-hub/scripts/mobile_flutter_release_handoff.ps1)
8. optionally drive and summarize the whole lane with [D:/business-hub/scripts/mobile_flutter_release_pipeline.ps1](D:/business-hub/scripts/mobile_flutter_release_pipeline.ps1)
9. archive the generated local release folder under `release-artifacts/mobile-local/<release-tag>/` when not using GitHub Actions
10. confirm `.github/workflows/flutter_mobile_validate.yml` is green
11. if using the dedicated mobile release lane, trigger `.github/workflows/flutter_mobile_release.yml`
12. copy into `release-artifacts/`
13. distribute to internal testers
14. verify:
   - login
   - data hydration
   - sales creation
   - back navigation
   - multi-screen movement
15. complete:
   - [D:/business-hub/docs/mobile-pilot-readiness-signoff.md](D:/business-hub/docs/mobile-pilot-readiness-signoff.md)
   - [D:/business-hub/docs/mobile-release-readiness-checklist.md](D:/business-hub/docs/mobile-release-readiness-checklist.md)
   - [D:/business-hub/docs/mobile-release-notes-template.md](D:/business-hub/docs/mobile-release-notes-template.md)
   - [D:/business-hub/docs/mobile-launch-operations-runbook.md](D:/business-hub/docs/mobile-launch-operations-runbook.md)
   - [D:/business-hub/docs/mobile-pilot-smoke-sheet.md](D:/business-hub/docs/mobile-pilot-smoke-sheet.md)
   - [D:/business-hub/docs/mobile-pilot-recovery-playbook.md](D:/business-hub/docs/mobile-pilot-recovery-playbook.md)

## Production blockers for Flutter mobile

Do not call Flutter mobile final production-ready until:
- customer parity is good enough
- history/reporting parity is good enough
- settings/team parity is good enough
- sync reliability is proven across real devices
- release signing/distribution strategy is finalized
- dedicated Flutter validation CI stays green on the release branch/tag

## Rollback strategy

### Web/admin

- rollback to prior hosting release or prior stable commit

### Mobile

- keep old mobile path available until Flutter cutover is approved
- distribute previous stable beta APK if needed

## Release ownership

Suggested release owners:
- product owner approves scope
- engineering approves technical readiness
- QA approves test completion
- operations approves deployment path

## Mobile versioning note

Flutter release versioning is driven by:
- [D:/business-hub/apps/mobile_flutter/pubspec.yaml](D:/business-hub/apps/mobile_flutter/pubspec.yaml)

Format:
- `marketing_version+build_number`
- example: `1.3.8+8`
