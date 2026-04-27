# Flutter Mobile Migration Plan

## Goal

Create a smooth mobile-first Business Hub app in Flutter without disturbing the current web/admin app.

## Folder strategy

The current web stack stays in place.

```text
apps/
  desktop/
  mobile_flutter/
```

This lets us:
- keep the live website stable
- keep Firebase rules/functions/shared backend logic
- migrate mobile in slices

## Why not Realtime Database

The mobile lag pain is mostly from rendering, local storage strategy, and WebView overhead.

The new Flutter app should use:
- SQLite locally for fast reads and writes
- Firestore for sync, sharing, and backup
- background queue flushes instead of blocking UI

## Recommended mobile stack

- Flutter
- Riverpod
- Drift + SQLite
- Firebase Auth
- Cloud Firestore
- Firebase Storage
- Firebase Crashlytics
- Firebase Performance

## Package naming strategy

During migration:
- use `com.businesshub.pro.dev` for development and beta installs

At production cutover:
- switch to `com.businesshub.pro` so the Flutter app can replace the current mobile app identity

## Phases

### Phase 0 - Scaffold
- create the Flutter app folder
- wire Firebase bootstrap
- define router/theme/app shell

### Phase 1 - Auth shell
- email/password and Google sign-in
- shop membership resolution
- role-based route entry

### Phase 2 - Local database
- create Drift schema for:
  - inventory
  - inventory_private
  - customers
  - sales
  - sale_items
  - sale_payments
  - expenses
  - attendance
  - outbox
  - sync_state
- precompute mobile summary tables for dashboard and low-stock counts

### Phase 3 - Sync engine
- Firestore pull into SQLite
- local outbox push to Firestore
- conflict handling and audit trail
- background retry

### Phase 4 - POS
- local-first catalog lookup
- barcode scan
- cart
- split payments
- receipt creation
- stock validation and force-sale policy

### Phase 5 - Inventory
- paged category / product / variant browsing
- edits with offline queue
- low-stock view

### Phase 6 - Dashboard and history
- summary cards from local aggregates
- deferred charts
- recent activity slices only

### Phase 7 - Cutover
- QA on real phones
- compare sales/inventory parity with current app
- swap package/application identity for release

## Immediate next implementation target

1. Install Flutter SDK on the build machine.
2. Run `flutter create` inside `apps/mobile_flutter`.
3. Run `flutterfire configure`.
4. Implement auth shell.
5. Port local database schema.
