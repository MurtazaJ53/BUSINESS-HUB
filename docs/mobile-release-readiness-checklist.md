# Mobile Release Readiness Checklist

## Purpose

This checklist is the final gate before shipping a Flutter APK outside the internal dev loop.

## Versioning

1. Update [D:/business-hub/apps/mobile_flutter/pubspec.yaml](D:/business-hub/apps/mobile_flutter/pubspec.yaml) `version: x.y.z+build`.
2. Write the exact user-facing changes in [D:/business-hub/docs/mobile-release-notes-template.md](D:/business-hub/docs/mobile-release-notes-template.md).
3. Confirm the release target:
   - internal beta
   - pilot shop build
   - wider production rollout

## CI and build gate

1. Confirm `.github/workflows/flutter_mobile_validate.yml` is green.
2. Run locally:
   - `flutter analyze`
   - `flutter test`
   - `flutter build apk --debug`
3. Build release APK:
   - `flutter build apk --release`

## Mobile smoke gate

1. Owner login works.
2. Staff login works.
3. Inventory search/add works.
4. Scanner flow works on device camera.
5. POS checkout works for:
   - cash
   - UPI
   - split payment
   - credit / partial due
6. Customer attach works in checkout.
7. Existing-due customer triggers credit exposure confirmation.
8. Customer ledger payment/adjustment works.
9. History feed shows:
   - filtered report pulse
   - payment mix
   - receipt detail
10. Settings edit works for admin account.

## Sync and recovery gate

1. Sale saves locally when backend is unavailable.
2. Outbox replay succeeds after connectivity returns.
3. Failed receipt retry works from History and Settings.
4. Domain-state posture still matches the backend migration state.

## Release packaging

1. Archive the final APK path:
   - `apps/mobile_flutter/build/app/outputs/flutter-apk/app-release.apk`
2. Copy it into the release artifact location used by the team.
3. Attach release notes.
4. Record the version and commit hash.

## Go / no-go rule

Release only if:
- CI is green
- smoke flows are green
- sync recovery is green
- release notes are written
- rollback APK is available
