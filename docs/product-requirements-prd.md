# Business Hub Product Requirements Document

## Objective

Define the current and target requirements for Business Hub as a retail operations platform, with special focus on the move toward a production-grade Flutter mobile app.

## Product goals

1. Support daily retail operations end to end
2. Stay usable under weak or intermittent internet
3. Provide accurate business state across devices
4. Keep mobile performance high with large datasets
5. Preserve permission and security boundaries

## Functional requirements

### FR-1 Authentication and session

The system must:
- support email/password sign-in
- recover shop membership for valid users
- distinguish owner/admin/staff roles
- block suspended users

### FR-2 Shop context

The system must:
- attach every authenticated user to a shop
- recover owner context if claims lag
- recover staff context if membership exists

### FR-3 POS

The system must:
- search products by name, SKU, or exact lookup
- add products to cart quickly
- support quantity changes
- support force sale confirmation without a PIN
- create a sale record
- decrement stock correctly
- sync sale to Firestore

### FR-4 Inventory

The system must:
- load catalog by page
- filter by category
- search efficiently
- show stock and price
- highlight low-stock items

### FR-5 Dashboard

The system must:
- show revenue summary
- show product totals
- show inventory value
- show low-stock counts
- show recent sales or business activity

### FR-6 Customers

The full product should:
- store customers
- track balances
- track payments
- support customer lookup during sales

Current note:
- this is stronger in the web/admin app than in Flutter mobile today

### FR-7 Expenses

The full product should:
- record expenses
- categorize them
- keep them visible for reporting

### FR-8 Team and permissions

The system must:
- store staff records
- assign roles
- apply granular permissions
- restrict sensitive views like cost visibility

### FR-9 Attendance

The system should:
- record attendance
- support daily staff presence tracking
- support payroll-adjacent reporting

### FR-10 Sync and offline behavior

The system must:
- remain usable when local data is already present
- sync cloud changes into local storage
- avoid freezing the UI during sync
- preserve correctness after reconnect

### FR-11 Backup and recovery

The full product should:
- retain important cloud state
- support local recovery behavior
- reduce operator risk after device failure or reinstall

## Non-functional requirements

### NFR-1 Performance

- mobile startup should feel fast
- product search should remain responsive on large catalogs
- scrolling should remain smooth on mobile
- large lists should not block the UI thread

### NFR-2 Reliability

- local writes should not silently disappear
- cloud sync should recover from interruptions
- permission failures should not crash app flows

### NFR-3 Security

- staff must not gain owner/admin access accidentally
- cost data must remain restricted
- private documents must not be readable from clients

### NFR-4 Scalability

- app should support large catalogs and long transaction history
- heavy analytics should not block core retail actions

### NFR-5 Maintainability

- mobile and web should share backend truth
- docs should make current parity gaps explicit

## Current release reality

### Web/admin app

Meets more requirements today for:
- full operational coverage
- broad local data support
- reporting and staff-related flows

### Flutter mobile app

Currently strongest for:
- auth shell
- mobile shell/navigation
- dashboard foundation
- inventory browsing
- POS foundation
- improved sync bootstrap

Still incomplete for:
- customer parity
- report/history parity
- settings/team parity
- full sync coverage

## Acceptance criteria for final mobile cutover

Flutter mobile should not replace the old mobile path until:

1. owner login works on real devices
2. staff login works on real devices
3. dashboard metrics reflect live business truth
4. inventory reflects live shop inventory
5. sales created on mobile appear correctly on web
6. offline to online recovery is reliable
7. customers/history/settings parity reaches acceptable business level

## Known risks

1. Old web local data can exceed current Flutter sync coverage
2. Shared cloud truth depends on data actually reaching Firestore
3. Performance gains can be lost if Flutter local schema grows without discipline

## Recommended next product work

1. complete Flutter customer flows
2. complete Flutter reporting/history flows
3. complete Flutter team/settings flows
4. add explicit sync visibility to mobile
5. expand mobile local schema carefully
