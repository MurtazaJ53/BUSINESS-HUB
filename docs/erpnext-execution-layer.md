# ERPNext Execution Layer For Business Hub

## Purpose

This document describes the first executable ERPNext integration layer added to the Business Hub backend.

It is not a full ERP migration.

It is the **PoC control surface** for:

- configuring a shop-to-ERPNext binding
- verifying ERPNext connectivity
- tracking sync cursor posture
- tracking local-to-ERP document links
- measuring one-shop PoC readiness

## What now exists in the backend

The backend now contains a dedicated ERPNext app:

- `platform_apps.erpnext`

It adds:

- ERPNext environment meta + health endpoints
- shop-level ERPNext bindings
- default pull/push sync cursor tracking
- local-to-ERP document-link tracking
- PoC summary endpoint for one-shop readiness

## Required environment variables

Set these in `apps/backend/.env`:

- `ERPNEXT_BASE_URL`
- `ERPNEXT_API_KEY`
- `ERPNEXT_API_SECRET`
- `ERPNEXT_SITE_NAME`
- `ERPNEXT_VERIFY_SSL`
- `ERPNEXT_TIMEOUT_SECONDS`

## New API endpoints

### Global

- `GET /api/v1/erpnext/meta/`
- `GET /api/v1/erpnext/health/`

### Shop-scoped

- `GET/PATCH /api/v1/shops/<shop_id>/erpnext/binding/`
- `POST /api/v1/shops/<shop_id>/erpnext/verify-connection/`
- `GET /api/v1/shops/<shop_id>/erpnext/sync-state/`
- `GET /api/v1/shops/<shop_id>/erpnext/poc-summary/`
- `GET /api/v1/shops/<shop_id>/erpnext/document-links/`

## Core models

### ERPNextShopBinding

Stores the shop-specific ERP mapping and PoC posture:

- environment
- company
- warehouse
- price list
- cost center
- customer group
- supplier group
- enabled feature flags
- last verified connection result

### ERPNextSyncCursor

Tracks pull/push state for the PoC domains:

- items
- customers
- stock
- suppliers
- purchases
- sales
- payments

### ERPNextDocumentLink

Tracks local object to ERP document mapping status for:

- items
- customers
- sales
- payments
- purchases

## Recommended PoC execution flow

1. Set ERPNext environment variables.
2. Create or fetch the shop binding with:
   - `GET /api/v1/shops/<shop_id>/erpnext/binding/`
3. Update the binding with real PoC values:
   - company
   - warehouse
   - price list
   - groups
4. Verify the connection:
   - `POST /api/v1/shops/<shop_id>/erpnext/verify-connection/`
5. Inspect sync cursor bootstrap:
   - `GET /api/v1/shops/<shop_id>/erpnext/sync-state/`
6. Inspect one-shop readiness:
   - `GET /api/v1/shops/<shop_id>/erpnext/poc-summary/`
7. Then begin the actual item/customer sync work.

## What this layer does not do yet

This first execution layer does **not** yet:

- import ERPNext items into Business Hub automatically
- import ERPNext customers automatically
- push POS sales into ERPNext sales documents automatically
- push payment events into ERPNext accounting automatically

That is the next implementation slice.

## Why this still matters

Without this layer, the ERPNext PoC is only a doc exercise.

With this layer, the team can now:

- prove connection posture
- configure one shop cleanly
- create a stable place for future sync/posting logic
- track PoC execution state explicitly inside the backend

## Recommended next code step

After this scaffold, the next implementation target should be:

1. item master pull from ERPNext
2. customer master pull from ERPNext
3. document-link creation on successful import
4. then sales/payment posting from Business Hub into ERPNext

