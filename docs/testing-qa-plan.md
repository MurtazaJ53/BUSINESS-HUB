# Business Hub Testing and QA Plan

## Purpose

This document defines the minimum testing required for Business Hub in its current mixed web + Flutter mobile state.

## Test categories

### 1. Build verification

Web:
- install dependencies
- build app
- run unit/rules tests where available

Flutter:
- analyze
- build APK
- add more automated tests over time

### 2. Auth tests

Must verify:
- owner login
- admin login
- staff login
- suspended-user rejection
- workspace recovery when claims lag

### 3. Data hydration tests

Must verify:
- dashboard loads shop data
- inventory loads catalog
- recent sales appear
- switching account/shop clears stale local data

### 4. POS tests

Must verify:
- product search
- add to cart
- quantity change
- force sale confirmation
- sale completion
- sale visible on another client after sync

### 5. Inventory tests

Must verify:
- category filter
- search
- paging
- low-stock visibility

### 6. Sync tests

Must verify:
- app starts with preloaded local data
- app hydrates from Firestore on first load
- reconnect behavior after offline period
- no silent data loss

### 7. Permissions tests

Must verify:
- non-admin users do not see blocked flows
- cost data stays restricted
- admin-only collections do not leak into staff UX

## Manual test matrix

| Scenario | Owner | Admin | Staff |
|---|---:|---:|---:|
| Login | Yes | Yes | Yes |
| Dashboard view | Yes | Yes | Limited |
| Inventory browse | Yes | Yes | Depends on permission |
| Cost visibility | Yes | Yes | Usually no |
| POS sale | Yes | Yes | Yes if allowed |
| Team/settings | Yes | Yes | Usually no |

## Devices to test

At minimum:
- Android low-mid performance phone
- Android stronger phone
- desktop browser for web/admin

## Regression focus

Watch these areas most closely:
- login and shop recovery
- sync hydration after reinstall
- inventory paging
- POS sale save
- back navigation on mobile

## Exit criteria for internal beta

Flutter beta can continue if:
- APK installs cleanly
- auth works
- dashboard/inventory/POS are usable
- basic multi-device sale sync works

## Exit criteria for full production cutover

Flutter mobile can replace the old mobile path only if:
- real owner/admin/staff acceptance is good
- missing parity flows are resolved
- sync failures are rare and visible
- product owner signs off
