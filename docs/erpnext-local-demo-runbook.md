# ERPNext Local Demo Runbook

## Purpose

This runbook gives you a fully local ERPNext testing path without live ERPNext credentials.

Use it when you want to:

- prove the Business Hub ERPNext integration end to end
- seed one demo shop automatically
- generate mock ERPNext item, customer, stock, supplier, purchase, sale, and payment traffic
- test the sync/posting cycle from the local backend only

## What it does

The local demo mode adds a persistent mock ERPNext client behind the same `ERPNextIntegrationService` used by the live path.

That means you can exercise:

- `verify_connection`
- item sync
- customer sync
- stock reconciliation
- supplier sync
- purchase order / receipt / invoice sync
- supplier payment sync
- sales push
- payment push

without a real ERPNext site.

## Required backend env

Set these in [D:/business-hub/apps/backend/.env](D:/business-hub/apps/backend/.env):

```env
ERPNEXT_BASE_URL=mock://erpnext
ERPNEXT_SITE_NAME=business-hub-mock
ERPNEXT_MOCK_MODE=true
ERPNEXT_VERIFY_SSL=true
ERPNEXT_TIMEOUT_SECONDS=15
ERPNEXT_MOCK_STATE_PATH=D:/business-hub/apps/backend/.erpnext-mock-state.json
```

No API key or API secret is required in mock mode.

## One-command bootstrap

Run from [D:/business-hub/apps/backend](D:/business-hub/apps/backend):

```powershell
D:\business-hub\apps\backend\.venv\Scripts\python.exe manage.py bootstrap_erpnext_demo --shop-slug demo-shop --limit 100 --reset-mock-state
```

This command will:

1. create the persistent mock ERPNext state file if needed
2. create a demo owner user
3. create a demo shop and owner membership
4. create and enable the ERPNext shop binding
5. verify the mock ERPNext connection
6. import ERPNext items and customers
7. seed a local Business Hub sale and payment
8. run the full ERPNext cycle
9. print the final summary JSON

You can then inspect the same shop from the admin web at:

- `/erpnext`

## Outputs you should expect

The command prints:

- `mock_state_path`
- `shop_id`
- `shop_slug`
- `owner_email`
- `seeded_sale`
- `cycle`
- `summary`

You should see:

- a successful health check
- imported ERPNext item/customer counts
- reconciled stock
- imported supplier/purchase counts
- pushed sales/payment counts
- linked document records for pull and push domains

## Main local artifacts

- backend env: [D:/business-hub/apps/backend/.env](D:/business-hub/apps/backend/.env)
- mock ERP state: [D:/business-hub/apps/backend/.erpnext-mock-state.json](D:/business-hub/apps/backend/.erpnext-mock-state.json)
- command: [D:/business-hub/apps/backend/platform_apps/erpnext/management/commands/bootstrap_erpnext_demo.py](D:/business-hub/apps/backend/platform_apps/erpnext/management/commands/bootstrap_erpnext_demo.py)
- client: [D:/business-hub/apps/backend/platform_apps/erpnext/mock_client.py](D:/business-hub/apps/backend/platform_apps/erpnext/mock_client.py)

## After bootstrap

After the bootstrap command succeeds, you can continue testing with:

```powershell
D:\business-hub\apps\backend\.venv\Scripts\python.exe manage.py run_erpnext_cycle --shop-slug demo-shop --limit 100
```

Or by calling the normal ERPNext API endpoints against the local backend.
