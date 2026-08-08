# System design decisions (scale + design)

Decisions I'm making on delegation, for a platform that must hold **millions of
users** and **millions of rows per user**, India-first, mobile/tablet only.
_2026-07-01._

## 0. What is already good — do NOT rebuild

The Django backend (`apps/backend`) is the **system of record** and is already
scale- and sync-aware. Keep it:

- UUID PKs, `SourceTrackedModel` base, tombstones (soft-delete sync), `domain_epoch` versioning.
- Tenant = `Shop`; every hot table carries `shop` FK with **composite tenant-first
  indexes** (`(shop, sale_date)`, `(shop, status)`…).
- `Decimal(12,2)` money (correct server-side type — not float).
- Idempotent writes: `SaleCommandReceipt` unique `(shop, command_id)` — the offline
  sync apply-once layer.
- Partial unique constraints (e.g. receipt number per shop).

Rebuilding this would destroy working, hard-won infrastructure.

## 1. Money representation (per layer)

- **Backend / DB:** keep `Decimal(12,2)`. Correct and exact.
- **Clients (Dart/JS):** store/compute **integer minor units**; never float. Format
  at the edge (`formatMinor`). Floats caused the rounding bug.
- **Transport:** integer minor units + `currencyCode`.

## 2. Tax — GST (added this pass)

India legally requires GST; it was entirely absent. Added to the schema:
- `Shop.gstin`, `Shop.state_code`, `Shop.region_code`.
- `InventoryItem.hsn_code`, `gst_rate`, `price_includes_tax`.
- `Sale` + `SaleItem`: `taxable_amount`, `tax_amount`, `cgst/sgst/igst`, snapshots.
- Canonical engine `sales/gst.py` (+ tests) — intra-state CGST+SGST vs inter-state IGST.

**Run:** `python manage.py makemigrations && migrate`. (Additive, default-valued —
safe; not run in this environment.)

## 3. Scale decisions (millions × millions)

1. **Postgres in production** (SQLite is dev-only — already env-switched). Set
   `CONN_MAX_AGE`, use PgBouncer for connection pooling at user scale.
2. **PK strategy:** migrate hot tables from random `uuid4` to **UUIDv7 / ULID**
   (time-ordered) to stop B-tree fragmentation and write hot-spotting at billions
   of rows. New tables: time-ordered IDs from day one.
3. **Partition the hottest tables** by `shop` (hash) or month: `sale`, `sale_item`,
   `payment`, `inventory_stock_ledger`, `audit`. Keeps indexes shallow per partition.
4. **Keyset (cursor) pagination only** on large lists — never `OFFSET` (O(n) at depth).
   Order by `(shop, created_at, id)`.
5. **Read scale:** read replicas; cache hot aggregates (today's totals) in Redis;
   precompute dashboards in `projections` rather than scanning sales live.
6. **Tenant isolation:** shared schema + `shop_id` everywhere (already the model) +
   enforced query scoping; consider Postgres RLS for defence in depth.
7. **Async + idempotent** heavy work (imports, projections, receipts) via a job
   queue (Celery/RQ); the `jobs` app + `command_id` idempotency already fit this.
8. **Archival/tiering:** move cold rows (old sales) to cheaper storage; keep the
   live partition small.

## 4. Design system — "like other business apps"

Target the feel of modern operational apps (Square, Zoho, Khatabook/Vyapar for
India), mobile/tablet-first:

- **Tokens once → many outputs.** Mobile `core/theme/*` is the source; emit CSS vars
  for web/admin. One palette, type scale (mobile-readable), spacing (4px grid),
  radius, elevation.
- **Touch-first:** ≥48dp targets, bottom-sheet actions, thumb-reachable primary CTA,
  large numeric keypad for POS, swipe actions on list rows.
- **Tablet:** master–detail (list + detail side by side), 2–3 column grids; phones
  collapse to a single column. One responsive layout, breakpoint-driven.
- **Patterns:** sticky cart/checkout bar, skeleton loaders (not spinners) for big
  lists, empty/error/offline states everywhere, optimistic UI with sync badges
  (already present).
- Mobile v3 screens are the live reference; extend to History/Settings/Auth, then web.

## 5. Build order

1. **GST vertical** end-to-end: serializers → sync apply → mobile/web POS calc →
   receipt (net/CGST/SGST/IGST/gross) → GST summary report. ← schema done
2. **Client money → minor units** (mobile + web), test-backed.
3. **Region layer** on web/admin (mirror mobile); kill remaining ₹ hard-codes via the layer.
4. **Design tokens unified**; finish v3 across surfaces; tablet master–detail.
5. **Scale hardening:** UUIDv7 on hot tables, partitioning, keyset pagination, Redis aggregates.
6. **Cleanup:** delete superseded screens; review `pilot_*` sprawl.

## 6. Honest constraints

- No Flutter/Node/Python toolchain on this machine → backend migrations and client
  builds are **not run/verified here**. The pure GST logic has unit tests; run
  `pytest platform_apps/sales/tests_gst.py` and `flutter test` to confirm green.
- "Zero-error" is achievable only with a runnable toolchain in the loop.
