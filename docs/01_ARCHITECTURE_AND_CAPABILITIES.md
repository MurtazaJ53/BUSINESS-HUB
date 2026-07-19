# Business Hub — Architecture & Capabilities (Deep Reference)

_Last verified 2026-07-19. Reflects the state after this engineering cycle: backend **197 tests passing**, Flutter **171 tests passing**, `flutter analyze` **clean**, signed release APK **v1.3.10** installed and running on a physical device._

This is the ground-truth map of what the product **is** and what **works today**. For what's left see `02_ROADMAP_AND_REMAINING.md`; for ideas see `03_IMPROVEMENTS_AND_NEW_FEATURES.md`.

---

## 1. The product in one paragraph
Business Hub is an **India-first POS + business-management app** for small/medium retailers. The live surfaces are a **Flutter mobile app** (offline-first, the thing cashiers use) and a **Django + DRF backend** (the source of truth + API). It handles selling (incl. by-weight/loose goods), inventory, customers with khata (credit ledger), suppliers & purchases, expenses, GST (CGST/SGST/IGST + GSTR-1/3B exports), UPI QR collection, thermal printing, and multi-device sync. A legacy React/Firebase web app has been **archived under `legacy/`**.

---

## 2. Stack & repo layout
| Path | Stack | Role |
|------|-------|------|
| `apps/mobile_flutter/` | Flutter, Riverpod, **Drift/SQLite** (offline cache), go_router | **Active** — the POS/mobile app |
| `apps/backend/` | **Django 6, DRF**, PostgreSQL/SQLite, Celery, Redis, Channels | **Active** — API + source of truth |
| `apps/admin_web/`, `apps/desktop/` | Next.js / Tauri | Secondary surfaces (not the focus) |
| `legacy/` | React + Vite + Capacitor + Firebase functions | **Archived** old app |

**Auth chain (DRF):** `JWTAuthentication` → `FirebaseAuthentication` → `DevHeaderAuthentication` (DEBUG only) → Session → Basic. JWT is HS256 (our `SECRET_KEY`); it only claims tokens it can verify, so Firebase tokens fall through untouched.

---

## 3. Backend — the 16 platform apps
`common, health, users, shops, inventory, customers, sales, payments, expenses, attendance, projections, jobs, audit, erpnext, purchases`.

### Domain models & what they do
- **shops** — `Shop` (GST fields: `gstin`, `state_code`, `region_code`; plan tier + feature flags), `ShopMembership` (roles: owner/admin/staff/viewer), workspace teams, access sessions, plan requests, domain migration state.
- **inventory** — `InventoryItem` (sell price, GST rate, HSN, price-includes-tax), `InventoryItemPrivate` (cost price, supplier, last purchase), **`InventoryStockLedger`** (event-sourced stock: opening/adjustment/sale/return/**purchase**/import/sync; `quantity_delta` is `Decimal(12,3)` → **fractional/by-weight stock**).
- **customers** — `Customer` (encrypted phone/email, balance, total_spent), **`CustomerLedgerEntry`** (khata timeline: sale/payment/adjustment/opening).
- **sales** — `Sale` + `SaleItem` (quantity `Decimal(12,3)`), GST breakdown per line & sale (CGST/SGST vs IGST resolved from place-of-supply), discount apportionment, returns, receipt numbers, idempotent command ingestion.
- **payments** — `SalePayment` (split payments, idempotent command endpoint).
- **purchases** _(new this cycle)_ — `Supplier` (payables balance), `Purchase` + `PurchaseItem`, `SupplierLedgerEntry`. Logging a purchase **auto-increments stock**, **refreshes cost price**, and **tracks payables**.
- **expenses** — `Expense` (category, payment method, date).
- **projections** — dashboard snapshots, **Pulse** (anomaly/risk signals), and **`ProfitAndLossView`** (revenue − COGS − expenses = net profit).
- **jobs** — the Firebase→Postgres **migration control plane** (per-domain cutover status; writes gated until `postgres_primary`).
- **audit** — workspace audit events + reconciliation.
- **erpnext** — optional two-way ERPNext sync (items, stock, sales invoices, payments).

### Key API endpoints (`/api/v1/…`)
- **Auth:** `POST session/token/`, `POST session/token/refresh/`, `session/` bootstrap, MFA + passkeys.
- **Catalog/stock:** `shops/{id}/inventory/`, `…/summary/`, `…/{item}/adjust-stock/`.
- **Selling:** `shops/{id}/sales/` (+ `/commands/` idempotent), `…/summary/`, `…/summary/gst/`, `…/{sale}/void/`.
- **GST exports:** `sales/export/gstr1/`, **`sales/export/gstr3b/`** (new).
- **Customers/khata:** `customers/`, `…/{id}/`, `…/{id}/ledger/`, **`…/{id}/timeline/`** (running balance, new).
- **Suppliers/purchases** _(new)_: `suppliers/` (+ `/summary/`, `/{id}/ledger/`), `purchases/` (+ `/summary/`, `/{id}/`).
- **Finance:** **`reports/profit-loss/`** (new), `projections/dashboard/`, `projections/pulse/`.
- **Expenses, attendance, payments, audit, ERPNext** each have their endpoints.

### RBAC
Role rank VIEWER(10) < STAFF(20) < ADMIN(30) < OWNER(40). Finance/procurement surfaces (P&L, suppliers, purchases, GST exports) require **ADMIN+** — a **cashier (staff) gets 403**. Enforced + unit-tested.

---

## 4. Mobile app — capabilities
Offline-first: writes hit local **Drift/SQLite** first, then sync to the backend via the outbox/sync coordinator. Feature areas:

- **POS (`pos_screen_v3`)** — cart, split payments, discounts (with a **manager-approval gate**), barcode scanning, **weight/price scale barcodes** (configurable, rate×weight), **"Quick weigh" grid** for loose goods, **dynamic UPI QR** for the exact total, thermal receipt printing, **cash-drawer kick** on CASH tender, held sales, custom/open items.
- **Inventory (`inventory_screen_v3`)** — fractional stock, categories, low-stock, cost/margin (role-gated), add/edit items.
- **Customers (`customers_screen_v3`)** — khata balances, WhatsApp receipts/reminders (no contact saved), ledger.
- **History / Reports** — sales history, GST summaries, P&L (`computeProfitAndLoss`), domain posture.
- **Dashboard** — today's sales, item counts, low-stock, sync status.
- **Settings → Import data** — see §5.
- **Security** — Staff PIN lock (verified on device); **biometric (fingerprint) manager approval** with PIN fallback for high-risk actions.

### Universal import _(new this cycle)_
- Reads **CSV** (bulletproof) **and XLSX** (wrapped — a bad file shows a clean "save as CSV" message instead of crashing).
- **Fuzzy auto-column-mapping**: any header layout (`MRP/Rate→price`, `Qty/On-hand→stock`, `Mobile/Contact→phone`, …) maps to our fields; a **preview sheet** lets the user override any column.
- **Separate cards**: Products & inventory, Customers, **Sales history (POS)**; each with **Sample template** download; Products/Customers also **Export CSV** (round-trips); Customers also **Import from phone contacts**.
- Engine is pure + **covered by 14 unit tests**.

---

## 5. What is verified working (this cycle)
| Check | Result |
|-------|--------|
| Backend `pytest` | **197 passed** |
| Flutter `flutter test` | **171 passed** |
| `flutter analyze` | **No issues found** |
| Signed release APK on device | Installs, launches, renders, PIN-locks (v1.3.10) |
| JWT auth end-to-end | login → Bearer → refresh → 401 negatives (live-tested) |
| Fractional stock | opening 35.5 − sales 3.25 = 32.25 kg exact |
| Procurement→inventory | purchase +stock, cost refresh, payables split (live) |
| P&L / GSTR-3B / RBAC | endpoints return correct data; cashier blocked (tested) |
| Git history | purged of binaries + leaked key (117 MB → 9.6 MB) |
| CI | `Build Android APK` + `CI` pinned & working; legacy workflows disabled |

---

## 6. Data & sync model (how it hangs together)
1. Cashier acts offline → write lands in Drift → UI updates instantly.
2. The sync coordinator posts idempotent **commands** (`/sales/commands/`, `/payments/commands/`) with a `command_id` + `base_domain_epoch`.
3. Backend accepts only when the domain is `postgres_primary` (migration control plane), computes GST/ledgers/balances, returns the canonical record.
4. Reads (dashboard, summaries) are server-computed projections; the app also keeps local projections for offline.
5. Stock is **event-sourced** (ledger), so quantity is always `Σ quantity_delta` — fractional-safe and auditable.
