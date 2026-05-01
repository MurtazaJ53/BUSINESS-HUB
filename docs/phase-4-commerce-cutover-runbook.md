# Phase 4 Commerce Cutover Runbook

## Purpose

This runbook defines the first safe production posture for Phase 4 commerce cutovers.

It covers:

- sales command ingestion
- payment command ingestion
- stock-ledger side effects
- customer-ledger side effects
- dashboard projection refresh after committed commerce facts

## Core rule

Commerce writes must enter the new backend as commands, not raw record overwrites.

That means:

- mobile/POS captures a command
- backend validates domain ownership and domain epoch
- backend commits facts transactionally
- backend records a durable command receipt
- repeated command replay must be idempotent

## Phase 4 write surfaces

### Sales

- endpoint: `/api/v1/shops/<shop_id>/sales/commands/`
- purpose: capture a sale command with items and payments in one atomic request
- current mobile posture:
  - Flutter POS writes the sale to local SQLite first
  - the mobile commerce outbox replays the command to Django
  - if the `sales` domain is PostgreSQL-primary, the mobile app refreshes recent sales from Django instead of Firestore

### Payments

- endpoint: `/api/v1/shops/<shop_id>/payments/commands/`
- purpose: capture a post-sale payment command against an existing sale
- current rollout note:
  - initial tender is already captured inside the sales command
  - standalone payment commands are reserved for follow-up credit collection and later mobile payment workflows

## Required guards

### Sales command

The sales command path must reject writes unless these domains are PostgreSQL-primary when controls exist:

- `sales`
- `payments`
- `stock_ledger`
- `customer_ledger` when the command touches a customer balance

### Payment command

The payment command path must reject writes unless these domains are PostgreSQL-primary when controls exist:

- `payments`
- `sales`
- `customer_ledger` when the sale belongs to a customer

## Epoch policy

Every command carries `base_domain_epoch`.

If the client captured the command against an old epoch:

- the backend rejects the command with `409`
- the client must rehydrate from the current server state
- no last-write-wins merge is attempted

## Idempotency policy

Each commerce command must include a stable `command_id`.

Rules:

- one command ID is unique per shop
- duplicate replay must return the original accepted fact, not create a second fact
- duplicate replay is expected during mobile reconnect and must be safe

## Mobile replay posture

- mobile outbox storage: `commerce_outbox`
- sync trigger:
  - immediately after local checkout
  - after session bootstrap
  - periodic retry while the app remains open
- failed replay stays queued with an error marker
- stale epoch rejection must not overwrite local facts; the operator must rehydrate from current server truth

## Fact side effects

### Sales command effects

- create `sales.Sale`
- create `sales.SaleItem[]`
- create `payments.SalePayment[]`
- create `inventory.InventoryStockLedger[]`
- create `customers.CustomerLedgerEntry` when credit is involved
- update customer running balance when relevant

### Payment command effects

- create `payments.SalePayment`
- update `sales.Sale.amount_received`
- update `sales.Sale.amount_due`
- create `customers.CustomerLedgerEntry` with payment event when relevant
- reduce customer running balance when relevant
- reject the command if it would drive the customer running balance negative

## Projection policy

After an accepted sales or payment command:

- refresh dashboard projection
- refresh low-stock preview when stock changed

Phase 4 currently allows synchronous projection refresh immediately after commit.
Later scaling can move this to dedicated Celery queues without changing command semantics.

## Rollback signals

Rollback should be considered when any of the following appear during pilot commerce cutover:

- duplicate financial facts from replay
- stock ledger mismatch against sale items
- customer balance drift after accepted payment commands
- repeated stale epoch rejection caused by old client versions
- dashboard projections diverging from committed sales or payment facts

## Operational checks before commerce cutover

1. `inventory` pilot is already PostgreSQL-primary for the shop.
2. `customers` pilot is already PostgreSQL-primary or explicitly accepted for the shop.
3. command replay tests passed in staging/dev.
4. reconciliation dashboard is monitored during first pilot usage.
5. rollback operator is assigned before live usage starts.

## Minimum operator checklist

1. verify domain ownership for `sales`, `payments`, `stock_ledger`
2. verify current epoch
3. execute first sales command
4. replay same command ID intentionally and confirm no duplicate fact
5. verify sale totals, stock ledger, and customer ledger
6. execute follow-up payment command when applicable
7. verify dashboard projection refresh
8. monitor reconciliation events
