# Business Hub Plan Tier Feature Matrix

## Purpose

This document turns the Business Hub packaging strategy into an explicit feature matrix.

The objective is to sell outcomes clearly without overwhelming clients with unnecessary ERP or admin complexity.

## Plans

### Starter

For small shops that need fast daily operations and simple visibility.

### Growth

For shops that need more operational structure without becoming ERP-heavy.

### Pro

For clients who need deeper business controls, selective finance depth, and stronger back-office support.

## Tier matrix

| Capability | Starter | Growth | Pro | Notes |
| --- | --- | --- | --- | --- |
| POS checkout | Yes | Yes | Yes | Core product feature |
| Barcode and fast lookup | Yes | Yes | Yes | Must stay premium across all plans |
| Inventory browsing | Yes | Yes | Yes | Core product feature |
| Low-stock alerts | Yes | Yes | Yes | Basic business visibility |
| Customers and due balances | Yes | Yes | Yes | Core retail need |
| Receipt history | Yes | Yes | Yes | Keep easy to scan |
| Daily sales summary | Yes | Yes | Yes | Default owner need |
| Store settings | Yes | Yes | Yes | Curated only |
| Expenses | No | Yes | Yes | Growth+ |
| Attendance | No | Yes | Yes | Growth+ |
| Staff management basics | No | Yes | Yes | Role-limited |
| Supplier directory | No | Yes | Yes | Hide unless active |
| Purchase workflow | No | Limited | Yes | Curated flow only |
| Advanced reports | No | Limited | Yes | Owner-focused, not analytics overload |
| Multi-branch visibility | No | No | Yes | Pro-only |
| Approval flows | No | No | Yes | Pro-only |
| Finance summary | No | No | Yes | Summary only, not raw accounting UI |
| Receivables / payables summary | No | No | Yes | Hidden unless needed |
| ERP-backed accounting workflows | No | No | Yes | Behind Pro and role gate |
| Backup posture summary | No | Limited | Yes | Surface confidence, not internals |
| Internal ERP controls | No | No | No | Never client plan features |

## Role-aware view within each plan

### Cashier

Should mainly see:

- POS
- product lookup
- customer attach
- receipt history needed for the floor

### Manager

Should mainly see:

- POS
- inventory
- customers
- history
- expenses if enabled
- attendance if enabled

### Owner

Should mainly see:

- dashboard
- reports
- due collections
- inventory health
- expenses
- attendance
- selected advanced controls by plan

## UI rule by plan

### Starter UI

Must feel minimal and calm:

- short navigation
- no advanced business noise
- no supplier or accounting clutter

### Growth UI

Can add more operational depth:

- expenses
- attendance
- light supplier and purchase capability

Still must avoid ERP menu sprawl.

### Pro UI

Can expose more owner/admin power, but still through curated Business Hub screens.

Pro should not mean:

- raw ERP forms everywhere
- giant sidebars
- complex accounting navigation by default

## Things that must stay hidden from all plan marketing

- DocType names
- ERP technical controls
- sync tools
- binding configuration
- account mapping setup
- tax configuration internals

Those are implementation details, not sellable product value.

## Commercial positioning

### Starter value statement

"Sell fast, track stock, manage customers, and see your daily business clearly."

### Growth value statement

"Add expenses, staff operations, and better business control without adding complexity."

### Pro value statement

"Get deeper business control, multi-branch readiness, and finance-backed operational discipline."

## Acceptance criteria

- each feature is mapped to a plan intentionally
- Pro is more powerful, but still curated
- Starter is not overloaded
- internal ERP mechanics are never confused with product features
