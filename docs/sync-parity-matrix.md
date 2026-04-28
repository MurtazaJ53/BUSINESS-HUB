# Business Hub Sync Parity Matrix

## Purpose

This document tracks which data and workflows are currently aligned between:
- Firestore cloud truth
- legacy web/admin local app
- Flutter mobile app

## Legend

- Full: implemented and actively used
- Partial: present but incomplete
- No: not implemented in that client path

## Entity parity

| Domain | Firestore | Web/Admin Local | Flutter Local | Notes |
|---|---|---|---|---|
| Shop settings | Full | Full | Full | Flutter reads and stores shop settings |
| Inventory | Full | Full | Full | Strongest mobile parity area |
| Inventory private | Full | Full | Full | Admin/cost path only |
| Sales | Full | Full | Full | Flutter stores sales in compact form |
| Sale items | Embedded/derived | Full | Partial | Flutter stores items JSON inside sale row |
| Sale payments | Embedded/derived | Full | Partial | Flutter stores payments JSON inside sale row |
| Customers | Full | Full | No | Important parity gap |
| Customer payments | Full | Full | No | Important parity gap |
| Expenses | Full | Full | No | Important parity gap |
| Staff | Full | Full | No | Flutter uses role recovery but not full local table |
| Staff private | Full | Full | No | Sensitive area, not mirrored locally yet |
| Attendance | Full | Full | No | Not yet mirrored in Flutter local DB |
| Invitations | Full | Partial UI | No | Mainly admin utility flow |
| Jobs/imports | Full | Partial/full old path | No | Flutter does not yet cover imports/jobs |

## Workflow parity

| Workflow | Web/Admin | Flutter | Status |
|---|---|---|---|
| Login and session | Full | Full | Good |
| Shop recovery | Full | Partial-to-good | Improved recently |
| Dashboard pulse | Full | Partial | Good foundation, not full parity |
| Inventory browsing | Full | Partial-to-good | Faster mobile path exists |
| POS / sale creation | Full | Partial-to-good | Core flow works, polish still needed |
| Customer management | Full | No/very partial | Gap |
| Expense management | Full | No | Gap |
| Team management | Full | No | Gap |
| History/reporting | Full | Partial/no | Gap |
| Import/migration tooling | Full/legacy path | No | Gap |

## Meaning

### Why parity matters

If a domain is not mirrored in Flutter:
- the UI may feel incomplete
- cross-device expectations can fail
- the old app can appear more capable even if Flutter feels smoother

### Current strongest Flutter areas

- auth and shell
- dashboard foundation
- inventory
- POS foundation
- sync bootstrap for shop/inventory/sales

### Highest-priority parity gaps

1. customers
2. history/reporting
3. settings/team
4. expenses
5. attendance

## Recommended next sync work

1. add customer tables and sync
2. add expense tables and sync
3. add staff and attendance local support
4. add mobile sync visibility counters
5. add mobile outbox and watermark tables if offline mutation scope grows
