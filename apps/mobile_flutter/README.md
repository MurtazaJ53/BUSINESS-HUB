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
