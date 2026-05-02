# Business Hub Mobile (Flutter)

This folder is the active Flutter mobile app track for Business Hub.

## Why it exists

- keep the current React/Vite stack stable for web and legacy surfaces
- build a smoother Android-first mobile experience in parallel
- move performance-critical mobile flows to Flutter + local SQLite

## Current state

- Flutter app scaffold is generated and buildable
- Android project is present under [D:/business-hub/apps/mobile_flutter/android](D:/business-hub/apps/mobile_flutter/android)
- Firebase bootstrap is wired for the existing `business-hub-pro` project
- local SQLite/Drift foundation exists under:
  - [D:/business-hub/apps/mobile_flutter/lib/core/database/local_database.dart](D:/business-hub/apps/mobile_flutter/lib/core/database/local_database.dart)
  - [D:/business-hub/apps/mobile_flutter/lib/core/database/mobile_repository.dart](D:/business-hub/apps/mobile_flutter/lib/core/database/mobile_repository.dart)
- sync coordinator exists under [D:/business-hub/apps/mobile_flutter/lib/core/sync/mobile_sync_coordinator.dart](D:/business-hub/apps/mobile_flutter/lib/core/sync/mobile_sync_coordinator.dart)
- feature slices already exist for:
  - auth/session
  - dashboard
  - inventory
  - POS

## Recommended commands

```bash
cd apps/mobile_flutter
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
flutter build apk --release
```

## Validation gate

Flutter mobile now has a dedicated GitHub Actions workflow:

- `.github/workflows/flutter_mobile_validate.yml`
- `.github/workflows/flutter_mobile_release.yml`

It runs:

- `flutter analyze`
- `flutter test`
- `flutter build apk --debug`

This gives the mobile track its own CI confidence gate instead of relying only on the older web/Capacitor release automation.

Release automation now also supports:

- tag-triggered mobile release builds with `mobile-v*`
- injected release channel and short SHA visibility inside the app Settings screen
- injected release tag and pilot scope visibility inside the app Settings screen
- signed Flutter release builds when Android signing secrets or `key.properties` are present
- APK checksum and manifest artifacts for pilot handoff verification

## Release readiness

When preparing a real APK handoff, use:

- [D:/business-hub/docs/mobile-release-readiness-checklist.md](D:/business-hub/docs/mobile-release-readiness-checklist.md)
- [D:/business-hub/docs/mobile-release-notes-template.md](D:/business-hub/docs/mobile-release-notes-template.md)
- [D:/business-hub/docs/mobile-launch-operations-runbook.md](D:/business-hub/docs/mobile-launch-operations-runbook.md)
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

Versioning currently follows `pubspec.yaml`:

- `version: marketing_version+build_number`
- example: `1.3.8+8`

## Phase 4 commerce setup

The mobile POS now queues commerce commands locally and replays them to Django when the shop domain is ready.

- backend base URL is injected with:
  - `--dart-define=BUSINESS_HUB_API_BASE_URL=http://<host>:8000/api/v1`
- Android emulator default is:
  - `http://10.0.2.2:8000/api/v1`
- local sales are stored first in SQLite
- accepted sales are replayed to:
  - `/shops/<shop_id>/sales/commands/`
- queued commands retry automatically while the app is open
- when the `sales` domain becomes PostgreSQL-primary, recent sales refresh from Django instead of Firestore

Current Phase 4 scope:

- sale command replay is active
- initial sale payments travel inside the sale command
- standalone follow-up payment command infrastructure exists in the backend for later mobile credit-collection UI

## Current parity posture

The mobile app now includes:

- dashboard, inventory, POS
- customers with migrated-ledger actions and collections workflow
- history with reporting pulse and payment-mix visibility
- settings with admin workspace edits
- scanner flow
- split payment and credit exposure safeguards

The remaining work is mostly production polish and deeper analytics, not basic workflow absence.

The Settings screen also now includes a copyable pilot launch snapshot so operators can archive build, queue, and domain posture directly from a real device.
It now also includes an operator action center that recommends the next operational move based on live readiness and recovery posture.
It also includes a recovery desk for queued or failed receipt replay during pilot rollout.
It now also includes a readiness signoff verdict so a rollout lead can decide whether the device is safe to start a pilot shift.
It also includes a full handoff pack copy action so release evidence can be archived from the device in one paste.
It now also includes a guided smoke checklist runner that copies a structured floor-execution report from the device itself.
It also now includes a shift closeout flow so the end-of-shift device state can be handed to the next operator or rollout lead with a clear decision.
It now also includes a consolidated rollout evidence pack for a single wave-level operator export when the rollout lead wants one final copied record.
It now also includes an incident escalation pack so support and engineering can get one structured failure export directly from the affected device.
It now also includes an evidence tracker so operators can see which rollout exports have already been captured and which core handoff artifacts are still missing.
That evidence tracker now survives app restarts on the same workspace because it is persisted in the local SQLite layer.
It now also supports named evidence sessions so a shared device can clearly separate one shift or rollout wave from the next.
It now also keeps a short archive of recent completed evidence sessions so the previous shift summary can still be copied after a fresh session starts.
It now also supports full archive export and archive clearing so stale session history can be managed without deleting the active evidence session.
It now also summarizes recent archive health so rollout leads can quickly tell whether recent shifts are closing cleanly or still leaving evidence gaps.

## Package strategy

- keep the Flutter beta app on a side-by-side package while migration is in progress
- switch back to the production package name only when Flutter is ready to replace the legacy mobile app

## Target architecture

- UI: Flutter
- State: Riverpod
- Local database: Drift + SQLite
- Cloud during transition: Firebase Auth + Firestore + Storage + Functions
- Long-term backend target: Django + PostgreSQL APIs
- Stability: Crashlytics
- Performance telemetry: Firebase Performance

## Migration order

1. auth/session shell
2. local SQLite schema and repositories
3. sync queue between SQLite and cloud/backend
4. POS
5. inventory
6. dashboard
7. customers / history / reports

## Important

- keep the current web/admin app stable during migration
- port features in slices, not with a big-bang rewrite
- treat offline replay as commands, not record overwrites
