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
