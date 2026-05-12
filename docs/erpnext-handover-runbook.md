# ERPNext Handover Runbook

## Purpose

This is the practical handover document for the current ERPNext integration inside Business Hub.

Use it to:

- configure the backend
- bind one shop
- verify ERPNext access
- run the first import/export cycle
- inspect failures

## What is implemented right now

Business Hub can now:

- verify ERPNext connectivity
- import ERPNext `Item` records into local inventory
- import ERPNext `Customer` records into local customers
- reconcile local stock against ERPNext `Bin` quantities
- import ERPNext `Supplier` records into local mirror tables
- import ERPNext `Purchase Receipt` documents into local mirror tables
- post local `Sale` records into ERPNext `Sales Invoice`
- post local `SalePayment` records into ERPNext `Payment Entry`
- track sync cursors and document links
- run the whole cycle from HTTP or CLI
- enqueue the cycle over Celery

## What is not implemented yet

These still remain outside the current handover scope:

- supplier-side payment / return handling
- purchase-order / purchase-invoice coverage
- default recurring beat schedule policy
- admin-web control plane for ERPNext operations

## Required backend env

Set these in [D:/business-hub/apps/backend/.env.example](D:/business-hub/apps/backend/.env.example) and then copy into `.env`:

- `ERPNEXT_BASE_URL`
- `ERPNEXT_API_KEY`
- `ERPNEXT_API_SECRET`
- `ERPNEXT_SITE_NAME`
- `ERPNEXT_VERIFY_SSL`
- `ERPNEXT_TIMEOUT_SECONDS`

For a fully local demo without live credentials, use:

- `ERPNEXT_BASE_URL=mock://erpnext`
- `ERPNEXT_SITE_NAME=business-hub-mock`
- `ERPNEXT_MOCK_MODE=true`
- `ERPNEXT_MOCK_STATE_PATH=D:/business-hub/apps/backend/.erpnext-mock-state.json`

## Required shop binding fields

Patch the binding endpoint:

- `is_enabled`
- `company`
- `warehouse`
- `selling_price_list`
- `currency_code`
- `supplier_group` when you want to narrow supplier import

Recommended `metadata_json`:

```json
{
  "walk_in_customer_name": "Walk In Customer",
  "default_payment_account": "Cash - ZR",
  "payment_account_map": {
    "CASH": "Cash - ZR",
    "UPI": "UPI Clearing - ZR",
    "CARD": "Card Clearing - ZR",
    "BANK": "Bank - ZR"
  },
  "mode_of_payment_map": {
    "CASH": "Cash",
    "UPI": "UPI",
    "CARD": "Card",
    "BANK": "Bank"
  },
  "receivable_account": "Debtors - ZR"
}
```

## Main endpoints

- `GET /api/v1/erpnext/meta/`
- `GET /api/v1/erpnext/health/`
- `GET/PATCH /api/v1/shops/<shop_id>/erpnext/binding/`
- `POST /api/v1/shops/<shop_id>/erpnext/verify-connection/`
- `GET /api/v1/shops/<shop_id>/erpnext/sync-state/`
- `GET /api/v1/shops/<shop_id>/erpnext/poc-summary/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-items/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-customers/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-stock/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-suppliers/`
- `POST /api/v1/shops/<shop_id>/erpnext/sync-purchases/`
- `POST /api/v1/shops/<shop_id>/erpnext/push-sales/`
- `POST /api/v1/shops/<shop_id>/erpnext/push-payments/`
- `POST /api/v1/shops/<shop_id>/erpnext/run-cycle/`
- `POST /api/v1/shops/<shop_id>/erpnext/enqueue-cycle/`
- `GET /api/v1/shops/<shop_id>/erpnext/suppliers/`
- `GET /api/v1/shops/<shop_id>/erpnext/purchases/`
- `GET /api/v1/shops/<shop_id>/erpnext/document-links/`

## Recommended first-run sequence

1. Verify global env posture:
   - `GET /api/v1/erpnext/meta/`
2. Verify live connectivity:
   - `GET /api/v1/erpnext/health/`
3. Fetch or create the shop binding:
   - `GET /api/v1/shops/<shop_id>/erpnext/binding/`
4. Patch the binding with company, warehouse, and payment-account mapping.
5. Verify the shop connection:
   - `POST /api/v1/shops/<shop_id>/erpnext/verify-connection/`
6. Pull item masters:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-items/`
7. Pull customer masters:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-customers/`
8. Reconcile stock:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-stock/`
9. Pull suppliers:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-suppliers/`
10. Pull purchase receipts:
   - `POST /api/v1/shops/<shop_id>/erpnext/sync-purchases/`
11. Push sales:
   - `POST /api/v1/shops/<shop_id>/erpnext/push-sales/`
12. Push payments:
   - `POST /api/v1/shops/<shop_id>/erpnext/push-payments/`
13. Inspect cursor and link state:
   - `GET /api/v1/shops/<shop_id>/erpnext/sync-state/`
   - `GET /api/v1/shops/<shop_id>/erpnext/document-links/`

## One-call cycle runner

### HTTP

```json
POST /api/v1/shops/<shop_id>/erpnext/run-cycle/
{
  "limit": 100,
  "verify_connection": true,
  "sync_items": true,
  "sync_customers": true,
  "sync_stock": true,
  "sync_suppliers": true,
  "sync_purchases": true,
  "push_sales": true,
  "push_payments": true
}
```

### CLI

Run from [D:/business-hub/apps/backend](D:/business-hub/apps/backend):

```powershell
D:\business-hub\apps\backend\.venv\Scripts\python.exe manage.py run_erpnext_cycle --shop-slug demo-shop --limit 100
```

Useful variants:

```powershell
D:\business-hub\apps\backend\.venv\Scripts\python.exe manage.py run_erpnext_cycle --shop-id <uuid> --skip-payments
```

### Local mock bootstrap

For a zero-credential local ERPNext demo:

```powershell
D:\business-hub\apps\backend\.venv\Scripts\python.exe manage.py bootstrap_erpnext_demo --shop-slug demo-shop --limit 100 --reset-mock-state
```

See [D:/business-hub/docs/erpnext-local-demo-runbook.md](D:/business-hub/docs/erpnext-local-demo-runbook.md).

### Queue

Queue the same cycle over Celery:

```json
POST /api/v1/shops/<shop_id>/erpnext/enqueue-cycle/
{
  "limit": 100,
  "verify_connection": true,
  "sync_items": true,
  "sync_customers": true,
  "sync_stock": true,
  "sync_suppliers": true,
  "sync_purchases": true,
  "push_sales": true,
  "push_payments": true
}
```

## Failure triage

### Items fail to import

Check:

- ERPNext token permissions
- `Item` visibility in the target site
- `ERPNEXT_BASE_URL`

### Customers fail to import

Check:

- `Customer` visibility in ERPNext
- modified-date filters and returned fields

### Sales fail to push

Check:

- every sold inventory item has `source_system=erpnext` and a valid `source_id`
- a walk-in or mapped customer exists
- binding has `company`, `warehouse`, and `selling_price_list`

### Payments fail to push

Check:

- the sale already has a linked ERPNext Sales Invoice
- `default_payment_account` or `payment_account_map` is set
- the ERPNext mode/account names are valid in the target company

### Stock sync looks wrong

Check:

- the binding `warehouse` matches the ERP warehouse you actually want
- the items being reconciled already came from ERPNext and have `source_id`
- ERPNext `Bin.actual_qty` reflects the intended warehouse, not all warehouses combined

### Purchase sync looks incomplete

Check:

- purchase sync is enabled in the binding
- purchase receipts exist in the ERPNext warehouse you filtered to
- the supplier exists locally in the ERPNext supplier mirror first

## Handover acceptance checklist

The handover is considered usable when all are true:

- ERPNext health endpoint returns `ok`
- shop binding is configured
- item sync imports at least one live item
- customer sync imports at least one live customer
- stock sync reconciles at least one mapped item
- supplier sync imports at least one supplier
- purchase sync imports at least one purchase receipt
- at least one sale pushes to ERPNext Sales Invoice successfully
- at least one payment pushes to ERPNext Payment Entry successfully
- document links show `linked` results for item, customer, supplier, purchase, sale, and payment domains

## Main files

- [D:/business-hub/apps/backend/platform_apps/erpnext/services.py](D:/business-hub/apps/backend/platform_apps/erpnext/services.py)
- [D:/business-hub/apps/backend/platform_apps/erpnext/views.py](D:/business-hub/apps/backend/platform_apps/erpnext/views.py)
- [D:/business-hub/apps/backend/platform_apps/erpnext/tasks.py](D:/business-hub/apps/backend/platform_apps/erpnext/tasks.py)
- [D:/business-hub/apps/backend/platform_apps/erpnext/management/commands/run_erpnext_cycle.py](D:/business-hub/apps/backend/platform_apps/erpnext/management/commands/run_erpnext_cycle.py)
- [D:/business-hub/docs/erpnext-execution-layer.md](D:/business-hub/docs/erpnext-execution-layer.md)
