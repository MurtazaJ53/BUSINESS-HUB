# ERPNext Execution Layer For Business Hub

## Purpose

This document describes the executable ERPNext integration layer currently available in the Business Hub backend.

It is not a full ERP migration.

It is the current **execution surface** for:

- configuring a shop-to-ERPNext binding
- verifying ERPNext connectivity
- importing ERP masters and purchase-side data
- reconciling inventory posture
- posting sales and payments
- tracking sync cursor posture
- tracking local-to-ERP document links

## What now exists in the backend

The backend contains a dedicated ERPNext app:

- `platform_apps.erpnext`

It now adds:

- ERPNext environment meta + health endpoints
- shop-level ERPNext bindings
- default pull/push sync cursor tracking
- local-to-ERP document-link tracking
- supplier mirror storage
- purchase mirror storage
- supplier payment mirror storage
- stock reconciliation against ERPNext bins
- one-call run-cycle orchestration
- queueable Celery handoff for the cycle runner
- default recurring beat policy for enabled shop bindings
- admin-web control surface at `/erpnext`

## Required environment variables

Set these in `apps/backend/.env`:

- `ERPNEXT_BASE_URL`
- `ERPNEXT_API_KEY`
- `ERPNEXT_API_SECRET`
- `ERPNEXT_SITE_NAME`
- `ERPNEXT_VERIFY_SSL`
- `ERPNEXT_TIMEOUT_SECONDS`
- `ERPNEXT_MOCK_MODE`
- `ERPNEXT_MOCK_STATE_PATH`
- `ERPNEXT_CYCLE_BEAT_ENABLED`
- `ERPNEXT_CYCLE_BEAT_MINUTES`
- `ERPNEXT_CYCLE_BEAT_LIMIT`

## API endpoints

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
- `POST /api/v1/shops/<shop_id>/erpnext/sync-stock/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-suppliers/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-purchases/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-supplier-payments/`
- `POST /api/v1/shops/<shop_id>/erpnext/push-sales/`
- `POST /api/v1/shops/<shop_id>/erpnext/push-payments/`
- `POST /api/v1/shops/<shop_id>/erpnext/run-cycle/`
- `POST /api/v1/shops/<shop_id>/erpnext/enqueue-cycle/`
- `GET /api/v1/shops/<shop_id>/erpnext/suppliers/`
- `GET /api/v1/shops/<shop_id>/erpnext/purchases/`
- `GET /api/v1/shops/<shop_id>/erpnext/supplier-payments/`
- `GET /api/v1/shops/<shop_id>/erpnext/document-links/`

## Core models

### ERPNextShopBinding

Stores the shop-specific ERP mapping and runtime posture:

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

Tracks pull/push state for:

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
- suppliers
- sales
- payments
- purchases

### ERPNextSupplierMirror

Stores the current imported ERPNext supplier master set for a shop.

### ERPNextPurchaseMirror

Stores imported ERPNext purchase receipt documents for a shop.

The same mirror now also stores:

- `Purchase Order`
- `Purchase Invoice`
- return posture via `is_return` and `return_against_remote_name`

### ERPNextSupplierPaymentMirror

Stores imported outgoing supplier `Payment Entry` documents for a shop.

## Recommended execution flow

1. Set ERPNext environment variables.
2. Create or fetch the shop binding:
   - `GET /api/v1/shops/<shop_id>/erpnext/binding/`
3. Update the binding with company, warehouse, price list, and metadata mappings.
4. Verify the connection:
   - `POST /api/v1/shops/<shop_id>/erpnext/verify-connection/`
5. Inspect sync-state and PoC summary:
   - `GET /api/v1/shops/<shop_id>/erpnext/sync-state/`
   - `GET /api/v1/shops/<shop_id>/erpnext/poc-summary/`
6. Pull item masters:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-items/`
7. Pull customer masters:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-customers/`
8. Reconcile stock:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-stock/`
9. Pull suppliers:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-suppliers/`
10. Pull purchase orders, receipts, and invoices:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-purchases/`
11. Pull outgoing supplier payments:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-supplier-payments/`
12. Push sales:
   - `POST /api/v1/shops/<shop_id>/erpnext/push-sales/`
13. Push payments:
   - `POST /api/v1/shops/<shop_id>/erpnext/push-payments/`
14. Or run the whole thing:
   - `POST /api/v1/shops/<shop_id>/erpnext/run-cycle/`

## Binding metadata_json conventions

The live execution path uses these keys:

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

The binding fields themselves now also matter for the expanded import path:

- `warehouse`
  Used for stock-bin and purchase-receipt filtering.
- `supplier_group`
  Optional supplier import filter.

## What is now complete repo-side

This execution layer now covers the repo-side ERPNext integration scope for:

- master data pull
- stock reconciliation
- purchase orders, receipts, invoices, and returns mirror posture
- outgoing supplier payment mirror posture
- sales and customer-payment push
- recurring enabled-shop cycle policy
- admin-web ERPNext controls
- local mock-demo execution without live credentials

## Why this matters

Without this layer, the ERPNext path is only a planning exercise.

With this layer, the team can now:

- prove connection posture
- configure one shop cleanly
- import ERP masters
- reconcile stock
- mirror purchase-side operations
- mirror supplier-side payments
- push sales and payments
- track failures explicitly
- operate cycles from HTTP, CLI, Celery, or default beat orchestration
