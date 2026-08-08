# Business Hub — App Analysis Report

_Generated 2026-07-15. Scope: the two active surfaces — Django backend (`apps/backend`) and Flutter mobile (`apps/mobile_flutter`) — on branch `chore/stabilize-fixes-theme-cleanup` with the uncommitted "fractional stock" work in the tree._

---

## 1. Executive summary

The working tree was **mid-way through a "true fractional stock" change** (selling/receiving by weight): several model fields were switched from integer to `Decimal`, but the **read/aggregation side was not updated to match**. That left the backend broken:

- **27 of 179 backend tests failed** (README last recorded 178 passing on 2026-07-07).
- Core read endpoints — **inventory summary, projections dashboard, pulse, sales/payments commands, ERPNext sync** — returned **HTTP 500**.

**Root cause:** aggregations like `Coalesce(Sum("quantity_delta"), 0)` still passed an **integer** `0` as the default, while `quantity_delta` was now a `DecimalField`. Django rejects the mix:

> `FieldError: Expression contains mixed types: DecimalField, IntegerField. You must set output_field.`

A second, related defect broke ERPNext sales push: a `Decimal` quantity was placed into a dict later stored in a `JSONField`, which the default JSON encoder can't serialize.

**All of this is now fixed** (10 edits across 5 files). **Backend tests: 179/179 passing.** A `seed_demo` management command was added and run, so you can check the app against realistic data immediately.

| Check | Before | After |
|-------|--------|-------|
| Backend `pytest` | 27 failed / 152 passed | **179 passed** |
| `manage.py makemigrations --check` | no drift | no drift |
| Flutter `flutter analyze` | 14 issues (0 before the diff) | **0 issues — clean** |
| Demo data | none | **seeded** (`seed_demo`) |

---

## 2. Bugs found & fixed (backend)

### 2.1 BLOCKER — Decimal/Integer mixed-type aggregation (9 sites) ✅ fixed
The `fractional stock` change made `InventoryStockLedger.quantity_delta` and `SaleItem.quantity` `DecimalField`s, but stock aggregations still defaulted to integer `0`. Every affected query raised `FieldError` at execution → HTTP 500.

Fixed by changing the Coalesce default `0` → `Decimal("0")` at:

| File | Lines |
|------|-------|
| `platform_apps/inventory/views.py` | 79, 117, 145, 169, 218, 297 |
| `platform_apps/projections/services.py` | 23 |
| `platform_apps/projections/pulse.py` | 157 |
| `platform_apps/erpnext/services.py` | 787 |

_(Money sums in the same files already used `Decimal("0.00")`; only the stock/quantity sums were left behind.)_

**Endpoints this un-breaks:** `GET .../inventory/`, `.../inventory/summary/`, `.../inventory/{id}/`, `.../projections/dashboard/`, `.../projections/pulse/`, `.../erpnext/sync-stock/`, and the reporting projection-refresh job.

### 2.2 BLOCKER — Decimal quantity not JSON-serializable in ERPNext push ✅ fixed
`platform_apps/erpnext/services.py:1224` built a Sales-Invoice payload with `"qty": item.quantity` (now a `Decimal`). That payload is stored into `ERPNextDocumentLink.metadata_json` (a `JSONField`), and Django's default encoder can't serialize `Decimal` → `TypeError`, swallowed as a per-sale failure so `pushed_count` stayed `0`. Changed to `"qty": str(item.quantity)` to match the already-stringified `"rate"`.

### 2.3 Minor — mangled indentation in sales serializer ✅ fixed
`platform_apps/sales/serializers.py:322` had a list-comprehension body flush against the left margin (valid Python, but jarring). Re-indented.

**Files changed:** `inventory/views.py`, `projections/services.py`, `projections/pulse.py`, `erpnext/services.py`, `sales/serializers.py`.

---

## 3. Cross-stack inconsistency ✅ fixed

The backend diff drove stock **toward** fractional (`Decimal`), but the mobile diff had moved the opposite way. Both spots are now aligned with the backend's by-weight support:

- `mobile_models.dart` — `InventoryMetrics.totalStock` restored `int` → **`double`**. (The Drift `stock` column is a `RealColumn`, so `SUM(stock)` returns a double; reading it as `int` was itself a latent bug.)
- `mobile_repository.dart` — the `total_stock` read restored `row.read<int>` → `row.read<double>`.
- `zobaze_import.dart` — opening stock parsing restored `_int(...)` → `_num(...)`, so **importing "1.5 kg" now keeps 1.5** instead of truncating to 1. The now-unused `_int` helper was removed.
- `dashboard_screen_v3.dart` — the stock caption now uses `formatQty(...)` so a fractional total renders as `32.25` (not `32.25` → `32.0`/`150.0`).

---

## 4. Flutter analyzer findings — all 14 ✅ fixed

The tree was previously "analyzes clean"; the uncommitted diff introduced 14 issues (10 `info`, 4 `warning`). All are now resolved (`flutter analyze` clean):

| Severity | Issue | Where | Fix applied |
|----------|-------|-------|-------------|
| warning | `_DomainPostureRow` unused | `history_screen.dart` | Removed the dead widget (never wired in) |
| warning | `_asInt` unused | `mobile_repository.dart` | Removed the dead helper |
| warning | Unused import `go_router` | `pos_screen_v3.dart` | Removed the import |
| warning | `invalid_null_aware_operator` | `customers_screen_v3.dart:501` | `asData?.value?.name` → `asData?.value.name` (`value` is non-null) |
| info ×3 | `activeColor` is deprecated | customers/inventory screens | Reverted `activeColor` → `activeThumbColor` (the diff had it backwards) |
| info ×5 | `unnecessary_underscores` | inventory/pos/reports | Reverted `(_, __)` → `(_, _)` |
| info | `use_build_context_synchronously` | `pos_screen_v3.dart` | Capture `ScaffoldMessenger` before the async gap, use the captured reference after |
| info | `unnecessary_string_interpolations` | inventory | `'${formatQty(item.stock)}'` → `formatQty(item.stock)` |

---

## 5. Good fixes already in the diff

Not everything in the tree is a regression — a couple of edits are correct:
- `pos_screen_v3.dart`: `ScaffoldMessenger.of(sheetContext)` → `.of(context)` **after** the sheet is popped — using the parent context is the right call (the analyzer nit above is separate and easily satisfied with a `mounted` guard).
- Backend `sales/tests.py`: a new `test_create_sale_accepts_fractional_quantity` was added and **passes** — good coverage for the by-weight path.

---

## 6. What's missing / recommended next

- **Fractional-stock rounding tests.** Add backend cases for weight lines whose `qty × price` produces >2 decimals (e.g. `1.250 × 45.00`) to lock in the money-rounding vs. quantity-precision boundary. The seed command hit exactly this edge.
- **Guard the aggregation default.** Consider a small helper (`sum_qty(field)`) so future `Sum(quantity...)` calls can't reintroduce the integer-default bug.
- **Regenerate Drift codegen** on the next mobile build (`dart run build_runner build --delete-conflicting-outputs`) — the `totalStock`/import changes are hand-written model code (no `.g.dart` impact), but run it before shipping to be safe.
- **Repo hygiene (from README, still true):** secrets in-tree (`service-account.json`, `.env`, `*.jks`) and ~700 MB of committed binaries (`*.apk`, `android (2).zip`, `apps.zip`, `src.zip`). The service-account key is already flagged for rotation in project memory.
- **ERPNext stock reconcile still truncates.** `erpnext/services.py:786-789` casts local stock to `int()` and compares against integer `actual_qty`. That's pre-existing and only affects the optional ERPNext integration, but it will drop fractional stock during reconcile — worth revisiting once by-weight is fully adopted.

---

## 7. Demo data — how to check the app

A new management command seeds a self-contained, write-ready workspace.

```bash
cd apps/backend
.venv/Scripts/python.exe manage.py migrate
.venv/Scripts/python.exe manage.py seed_demo --reset
.venv/Scripts/python.exe manage.py runserver 0.0.0.0:8000
```

**What it creates (`platform_apps/common/management/commands/seed_demo.py`):**
- **Owner:** `demo@businesshub.test` / `demo12345` (in DEBUG you can also send header `X-Dev-User-Email: demo@businesshub.test`).
- **Shop:** _Demo Mart_, GST-registered in Maharashtra (state `27`), Pro plan — so advanced reports/finance fields are visible.
- **All 11 migration domains promoted to `postgres_primary`**, so the Flutter POS command endpoints (`/sales/commands/`, `/payments/commands/`) accept writes.
- **11 catalog items**, including **3 loose/by-weight items** (Tomatoes, Sugar, Onions) with fractional opening stock (e.g. 35.5 kg).
- **5 customers**; **18 sales** over the last ~3 weeks (cash/UPI/card, some split, ~25% on credit leaving a customer balance, ~40% including a fractional weight line).

**Verified end-to-end after seeding:**
- `refresh_shop_dashboard_projection(shop)` builds with no error (the query that used to 500).
- Tomatoes stock: opening 35.5 − sales (1.25 + 0.50 + 1.50) = **32.25 kg** — fractional decrement is exact.
- 8 fractional sale lines recorded; one customer (Rahul Sharma) carries an outstanding balance.

Point the Flutter app at the server with
`--dart-define BUSINESS_HUB_API_BASE_URL=http://<your-lan-ip>:8000/api/v1`.

Re-run `seed_demo --reset` any time to get a clean, reproducible dataset (`random.seed(42)`).

---

## 8. Files touched by this analysis

**Backend fixes:** `platform_apps/inventory/views.py`, `platform_apps/projections/services.py`, `platform_apps/projections/pulse.py`, `platform_apps/erpnext/services.py`, `platform_apps/sales/serializers.py`.

**Mobile fixes:** `core/models/mobile_models.dart`, `core/database/mobile_repository.dart`, `core/import/zobaze_import.dart`, `features/dashboard/presentation/dashboard_screen_v3.dart`, `features/customers/presentation/customers_screen_v3.dart`, `features/inventory/presentation/inventory_screen_v3.dart`, `features/pos/presentation/pos_screen_v3.dart`, `features/reports/presentation/reports_screen.dart`, `features/history/presentation/history_screen.dart`.

**New:** `platform_apps/common/management/__init__.py`, `platform_apps/common/management/commands/__init__.py`, `platform_apps/common/management/commands/seed_demo.py`, `APP_ANALYSIS_REPORT.md`.

---

## 9. Feature build — operational gaps + POS (2026-07-15, follow-on)

Bridged the requested operational gaps and POS improvements. Backend is fully tested (**187 passed**, up from 179).

### 9.1 Procurement → Inventory (new `purchases` app) ✅
New Django app `platform_apps/purchases/` with **Supplier**, **Purchase**, **PurchaseItem**, and **SupplierLedgerEntry** models. Logging a purchase (via `PurchaseSerializer`, the same path the API uses):
- **auto-increments stock** — posts a `PURCHASE` entry to `InventoryStockLedger` per line (fractional-safe), so the owner never double-enters stock;
- **refreshes cost price** — updates `InventoryItemPrivate.cost_price` + `last_purchase_date` + `supplier_id` to the latest purchase;
- **tracks payables** — increases the supplier's `balance` by the unpaid amount and writes a supplier ledger (purchase `+total`, payment `-paid`).

**Endpoints** (feature-gated: `supplier_directory` / `purchase_workflow`):
`/suppliers/`, `/suppliers/summary/`, `/suppliers/{id}/`, `/suppliers/{id}/ledger/` (running-balance timeline), `/purchases/`, `/purchases/summary/`, `/purchases/{id}/`.
The mobile app already carries `PurchaseRecord` + tests, which this backend completes.

### 9.2 P&L connection ✅
New `ProfitAndLossView` at `/reports/profit-loss/` (gated on `finance_summary`). Computes, over a date range (default current month):
**revenue − COGS = gross profit**, then **− tracked expenses = net profit** (plus tax collected, net-margin %, and period purchases for cash-flow context). COGS is `Σ quantity × unit_cost` per sale line, with returns subtracting. Mirrors the mobile `computeProfitAndLoss` already unit-tested on the app side.

### 9.3 Customer Ledger / Khata ✅
New `CustomerLedgerTimelineView` at `/customers/{id}/timeline/`: a chronological Khata — credit sales, part-payments and adjustments — with a **running balance** computed oldest→newest and returned newest-first, plus the customer's current balance and lifetime spend.

### 9.4 POS: configurable weight/price barcodes ✅
`core/pos/weight_barcode.dart` extended from price-only to **weight-or-price, configurable** (`WeightBarcodeConfig.valueIsWeight`, `WeightBarcodeConfig.weightStandard` preset). A weight barcode now decodes grams→kg and charges **rate × weight** via `WeightBarcode.resolveLinePrice(itemRate)`; price barcodes still charge the embedded amount. POS scan flow wired to the new resolver; unit tests added.

### 9.5 POS: quick-key grid for loose goods ✅
A **"Quick weigh"** tap-to-add grid in the POS above the catalog, auto-populated from items marked loose (a weight `unit` or a "loose" name — owners customise it by tagging items). Tapping a tile opens a weight entry (with 250 g / 500 g / 1 kg / 2 kg presets) and adds a fractional line priced rate × weight, bypassing the search bar for rapid checkout.

### Tests
- Backend: `purchases/tests.py` (supplier opening balance, purchase→stock/cost/payable, supplier ledger running balance, plan gating, summary), `projections/test_reports.py` (P&L math + feature gate), `customers/test_timeline.py` (Khata running balance). **All green; full suite 187 passed.**
- Mobile: extended `test/weight_barcode_test.dart` (weight-mode decode + `resolveLinePrice`); existing `purchase_test.dart` / `profit_and_loss_test.dart` back the mobile models.
- `seed_demo` extended with 3 suppliers + 3 purchases so the demo shows procurement→inventory live.

### New/changed files (feature build)
**New backend:** `platform_apps/purchases/` (app), `platform_apps/projections/reports.py`, `platform_apps/customers/test_timeline.py`, `platform_apps/projections/test_reports.py`, migrations `purchases/0001_initial.py` + `inventory/0004_alter_...event_type.py`.
**Changed backend:** `inventory/models.py` (add `PURCHASE` event), `shops/urls.py`, `config/settings.py`, `seed_demo.py`.
**Changed mobile:** `core/pos/weight_barcode.dart`, `features/pos/presentation/pos_screen_v3.dart`, `test/weight_barcode_test.dart`.

---

## 10. Cloud/security + Indian retail + fraud controls (2026-07-16, follow-on)

### 10.1 Backend auth — self-contained JWT ✅ (tested)
New `platform_apps/users/jwt_auth.py` (`JWTAuthentication`, HS256 signed with `SECRET_KEY`) + `token_views.py`:
- `POST /api/v1/session/token/` → `{access, refresh}` from email+password.
- `POST /api/v1/session/token/refresh/` → fresh pair.
- Registered **first** in DRF auth classes; it only claims tokens whose signature verifies against our secret (returns `None` otherwise), so the existing Firebase Bearer path is untouched. Gives sync clients real token auth **without** needing your Firebase project. `test_jwt.py` — 6 tests green.

### 10.2 RBAC — cashier can't see finance/procurement ✅ (tested)
A cashier is a **STAFF** member; these now require **ADMIN+**, returning 403 for staff/viewer:
- P&L (`/reports/profit-loss/`), all supplier + supplier-ledger + purchase endpoints, and the GST exports.
Tests assert a STAFF user gets 403 on purchases, suppliers, supplier ledger, P&L and GSTR-3B.

### 10.3 GSTR-3B export ✅ (tested)
`GSTR3BExportView` at `/sales/export/gstr3b/` — section 3.1(a) outward-supplies summary CSV (taxable value + IGST/CGST/SGST by rate, plus a totals row) to key into the portal. Complements the existing GSTR-1 export. Admin-only.

### 10.4 Dynamic UPI QR on checkout ✅ (tested)
`core/pos/upi_qr.dart` (`buildUpiUri` → `upi://pay?pa=&pn=&am=&cu=INR&tn=&tr=`) + `upi_qr_view.dart` (renders via the `qr` encoder + a `CustomPainter`, no heavy widget dep). A **UPI QR** button in the POS header shows a QR for the exact net total; any UPI app pre-fills VPA + amount. Merchant VPA seeds from `--dart-define BUSINESS_HUB_UPI_VPA` or is entered in the dialog. `upi_qr_test.dart` — 5 tests.

### 10.5 Cash-drawer kick ✅ (already wired, now tested)
The ESC/POS pulse (`0x1B 0x70 0x00 0x19 0xFA`) already fires on CASH tender ([pos_screen_v3.dart:846]). Extracted to a testable `cashDrawerKickBytes({pin,onTime,offTime})`; `cash_drawer_test.dart` — 3 tests.

### 10.6 Fraud gate — manager approval ✅ (tested)
`core/security/manager_gate.dart` — `ManagerGate.requireManagerApproval(context, reason:)` with a constant-time-ish PIN check (`verifyPin`), seeded from `--dart-define BUSINESS_HUB_MANAGER_PIN` (empty = disabled). Wired to **discounted-sale finalization** (a real counter fraud vector); the same gate wraps void / Khata-delete flows as they gain UI. `manager_gate_test.dart` — 4 tests. **Note:** upgrading to Android **BiometricPrompt** is a drop-in inside this gate but needs the `local_auth` dependency + native config + a device — documented, not added here.

### 10.7 WhatsApp paperless billing — already present
`core/util/whatsapp.dart` (+ `whatsapp_test.dart`) builds a `wa.me` deep link and shares the receipt without saving the number to contacts; wired in POS + customers. Left as-is (already satisfies the ask).

### 10.8 Security & DevSecOps — staged for you ⚠️ (needs your action)
- **`service-account.json.example`** added; the real file stays gitignored/untracked.
- **`docs/SECURITY_ROTATION_AND_HISTORY_PURGE.md`** — runbook to (A) rotate the leaked Firebase key in your console and (B) purge history.
- **`scripts/purge_git_history.sh`** — `--analyze` (read-only, verified: history carries `android.zip` 82 MB, `functions.zip` 19 MB, …) and `--run` (rewrites history locally with `git-filter-repo`; **does not push**).
- **I did NOT** rotate the real key (needs your GCP/Firebase console) or force-push rewritten history (irreversible, breaks all clones/PRs on `hub` + `origin`) — per your "stage it, I run it" choice.

### 10.9 The sync "ultimate blocker" — status
The outbox/pull engine exists (`outbox_backoff_test.dart`). This phase delivered the **auth** half of the unblock (JWT, testable) and RBAC. Fully enabling two-way sync end-to-end — and the "offline → 50 fractional sales → reconnect" soak test — needs a live backend + device pairing (and your rotated Firebase creds if you use the Firebase path); that integration/soak run is the remaining step and can't be exercised headless here.

### Tests (this phase)
Backend: `users/test_jwt.py` (6) + RBAC/GSTR-3B additions. Mobile: `upi_qr_test.dart` (5), `manager_gate_test.dart` (4), `cash_drawer_test.dart` (3). New dep: `qr: ^3.0.0` (for QR rendering).
