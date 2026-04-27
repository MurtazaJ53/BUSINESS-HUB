# Business Hub Mobile (Flutter)

This folder is the new Flutter mobile app track for Business Hub.

Why it exists:
- keep the current React/Vite app stable for web and admin
- build a smoother Android-first mobile experience in parallel
- move mobile performance-critical flows to Flutter + native SQLite

Current status:
- Flutter app scaffold created
- Firebase mobile bootstrap wired for the existing `business-hub-pro` project
- architecture placeholders added for auth, dashboard, inventory, POS, local database, and sync
- native Android and iOS folders are not generated yet because the Flutter SDK is not installed in this shell

Recommended next commands after Flutter is installed:

```bash
cd apps/mobile_flutter
flutter create . --platforms=android --org com.businesshub.pro.dev
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutterfire configure --project=business-hub-pro --android-package-name com.businesshub.pro.dev
flutter run
```

Development package strategy:
- use `com.businesshub.pro.dev` while the Flutter app is in parallel beta
- switch back to `com.businesshub.pro` only when the Flutter mobile app is ready to replace the current Capacitor app

Target architecture:
- UI: Flutter
- State: Riverpod
- Local database: Drift + SQLite
- Cloud: Firebase Auth + Firestore + Storage + Functions
- Stability: Crashlytics
- Performance telemetry: Firebase Performance

Migration order:
1. Auth/session shell
2. Local SQLite schema and repositories
3. Sync queue between SQLite and Firestore
4. POS
5. Inventory
6. Dashboard
7. Customers / history / reports

Important:
- keep the current web app as source of truth for business logic during migration
- port features in slices, not with a big-bang rewrite
