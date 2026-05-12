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
- `POST /api/v1/shops/<shop_id>/erpnext/sync-items/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-customers/`
- `POST /api/v1/shops/<shop_id>/erpnext/push-sales/`
- `POST /api/v1/shops/<shop_id>/erpnext/push-payments/`
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
7. Pull item masters:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-items/`
8. Pull customer masters:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-customers/`
9. Publish locally captured sales:
   - `POST /api/v1/shops/<shop_id>/erpnext/push-sales/`
10. Publish locally captured payments:
   - `POST /api/v1/shops/<shop_id>/erpnext/push-payments/`

## Binding metadata_json conventions

The first live execution path uses a few binding-level metadata keys:

- `walk_in_customer_name`
  Use this when a Business Hub sale has no explicit ERPNext customer mapping.
- `default_payment_account`
  Fallback `paid_to` account for ERPNext Payment Entry creation.
- `payment_account_map`
  Per-method account mapping, for example `CASH`, `UPI`, `CARD`, `BANK`.
- `mode_of_payment_map`
  Optional override when ERPNext Mode of Payment names differ from Business Hub payment methods.
- `receivable_account`
  Optional override passed while creating Sales Invoice documents.

## What this layer does not do yet

This first live execution layer still does **not** yet:

- reconcile ERPNext stock deltas back into Business Hub stock projections
- import suppliers and purchase documents
- auto-submit ERPNext documents through a custom finalize step
- run background sync jobs continuously without an explicit trigger

## Why this still matters

Without this layer, the ERPNext PoC is only a doc exercise.

With this layer, the team can now:

- prove connection posture
- configure one shop cleanly
- create a stable place for future sync/posting logic
- track PoC execution state explicitly inside the backend

## Recommended next code step

After this scaffold, the next implementation target should be:

1. stock projection import from ERPNext warehouses / bins
2. supplier master pull
3. purchase document pull or posting
4. background job scheduling for recurring ERPNext sync
