# Business Hub Client-Facing Module Matrix

## Purpose

This document defines exactly which modules are:

- client-facing
- hidden back-office
- internal-only

It is the first hard gate for the curated Business Hub product model.

The core rule is simple:

**Clients should receive Business Hub workflows, not raw ERP complexity.**

## Classification rules

### Client-facing

These modules are allowed in normal client navigation and product sales materials.

### Hidden back-office

These modules may exist for some clients, but should not appear by default for all users or plans.

### Internal-only

These modules are strictly for Business Hub internal support, operations, finance setup, migration, or platform administration.

## Module matrix

| Module | Classification | Default roles | Default plans | Notes |
| --- | --- | --- | --- | --- |
| POS / Checkout | Client-facing | Cashier, Manager, Owner | Starter, Growth, Pro | Highest priority product surface |
| Product search / barcode | Client-facing | Cashier, Manager, Owner | Starter, Growth, Pro | Must stay fast and simple |
| Inventory list | Client-facing | Cashier, Manager, Owner | Starter, Growth, Pro | Show stock simply, hide heavy ERP fields |
| Low-stock alerts | Client-facing | Manager, Owner | Starter, Growth, Pro | Operational visibility, not ERP detail |
| Customers | Client-facing | Cashier, Manager, Owner | Starter, Growth, Pro | Focus on lookup, due balance, collections |
| Dues / Collections | Client-facing | Cashier, Manager, Owner | Starter, Growth, Pro | Core retail need, must remain simple |
| Daily sales summary | Client-facing | Manager, Owner | Starter, Growth, Pro | Business-first reporting |
| Recent receipts / history | Client-facing | Cashier, Manager, Owner | Starter, Growth, Pro | Keep filter complexity limited |
| Expenses | Client-facing | Manager, Owner | Growth, Pro | Should remain lightweight and business-readable |
| Attendance | Client-facing | Manager, Owner | Growth, Pro | Keep simple, avoid HR-system feel |
| Staff overview | Client-facing | Owner | Growth, Pro | Limited management view only |
| Store settings | Client-facing | Owner | Starter, Growth, Pro | Only practical store controls |
| Backup / recovery summary | Client-facing | Owner | Pro | Surface posture, not technical internals |
| Supplier directory | Hidden back-office | Manager, Owner | Growth, Pro | Allowed only if supplier workflows are active |
| Purchase requests | Hidden back-office | Manager, Owner | Growth, Pro | Curated flow, not raw ERP docs |
| Purchase approvals | Hidden back-office | Owner | Pro | Keep strongly gated |
| Advanced reporting | Hidden back-office | Owner | Pro | Curated dashboards, not generic ERP reports |
| Multi-branch controls | Hidden back-office | Owner | Pro | Only for clients who need it |
| Receivables / payables detail | Hidden back-office | Owner | Pro | Useful, but should not clutter core product |
| Accounting summary | Hidden back-office | Owner | Pro | High-level business view only |
| Supplier payments | Hidden back-office | Owner | Pro | Only where needed |
| Raw stock ledger | Internal-only | Support Admin, Platform Admin | Internal | Never default client UI |
| Chart of accounts | Internal-only | Support Admin, Platform Admin | Internal | Hide from normal clients |
| Journal entries | Internal-only | Support Admin, Platform Admin | Internal | ERP detail, not product value |
| Tax configuration | Internal-only | Support Admin, Platform Admin | Internal | Setup surface only |
| Payment account mapping | Internal-only | Support Admin, Platform Admin | Internal | Integration concern |
| ERP shop binding | Internal-only | Support Admin, Platform Admin | Internal | Technical control plane |
| ERP sync actions | Internal-only | Support Admin, Platform Admin | Internal | Keep out of normal owner UI |
| Migration control plane | Internal-only | Support Admin, Platform Admin | Internal | Platform operations only |
| Reconciliation tooling | Internal-only | Support Admin, Platform Admin | Internal | Not a standard client flow |
| Feature-flag management | Internal-only | Platform Admin | Internal | Platform control |

## Recommended main navigation by plan

### Starter

- Home / Dashboard
- POS
- Inventory
- Customers
- History
- Settings

### Growth

- Home / Dashboard
- POS
- Inventory
- Customers
- History
- Expenses
- Attendance
- Settings

### Pro

- Home / Dashboard
- POS
- Inventory
- Customers
- History
- Expenses
- Attendance
- Reports
- Settings

Advanced business controls should be placed behind a secondary owner area, not mixed into the primary cashier flow.

## Modules that should never be top-level for most clients

- suppliers
- purchases
- accounting
- tax
- ERP controls
- sync controls
- migration
- raw reports with too many filters

These may exist, but they should not define the product experience.

## UI implication

This matrix is also a UI boundary.

If a module is marked:

- `client-facing`, it must be simple, mobile-friendly, and understandable in seconds
- `hidden back-office`, it must be intentionally gated and introduced only where valuable
- `internal-only`, it must not leak into everyday client navigation or onboarding

## Hard rules

1. Do not put ERP or accounting terminology in cashier-critical flows.
2. Do not add modules to the main client nav just because they exist in the backend.
3. Do not expose setup, bindings, or mappings as client-visible product value.
4. Do not make owners feel like they bought an ERP menu tree.

## Acceptance criteria

- every current and future module must map into one classification
- client-facing navigation can be derived from this file without ERP ambiguity
- internal-only tools are kept out of normal plan discussions
