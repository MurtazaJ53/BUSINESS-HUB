# ERPNext Proof-Of-Concept Runbook For Business Hub

## Purpose

This runbook defines the smallest practical proof of concept needed to decide whether Business Hub should adopt ERPNext.

The goal is to answer one question:

**Can ERPNext materially reduce back-office custom work without damaging the mobile/POS product experience?**

## Proof-of-concept scope

Run the proof of concept on **one shop only**.

Do not start with a full migration.

## Target outcome

At the end of this runbook, the team should be able to choose one of three decisions:

1. proceed with hybrid ERPNext adoption
2. pause and keep Business Hub mostly custom
3. reject ERPNext as a primary path

## Timebox

Recommended timebox:

- **2 to 4 weeks**

If the proof of concept is still ambiguous after that, the scope is probably too wide.

## Baseline environment

Set up:

- one ERPNext v15 environment
- one Business Hub test environment
- one test shop profile
- one import sample dataset

## Sample dataset

Use a realistic but controlled sample:

- 100 to 300 products
- 25 to 100 customers
- 5 to 20 suppliers
- one warehouse
- one week of representative sales history
- a few pending customer dues
- a few purchase records

## Mandatory proof-of-concept flows

The proof of concept is incomplete unless all of these are tested.

## 1. Item master and catalog sync

Validate:

- create items in ERPNext
- update price and category
- sync to Business Hub projections
- confirm Flutter catalog displays correct data quickly

Success criteria:

- no manual reconciliation needed for basic item updates
- sync behavior is predictable
- local mobile browsing remains fast

## 2. Customer master and due visibility

Validate:

- create customer in ERPNext
- update phone and profile details
- expose customer in Business Hub
- confirm due display works correctly

Success criteria:

- customer master remains trustworthy
- mobile customer lookup stays quick
- no confusing mismatch between ERP and mobile display

## 3. Stock and warehouse flow

Validate:

- receive stock
- adjust stock
- confirm resulting stock view reaches Business Hub projections
- test low-stock visibility

Success criteria:

- stock ownership is clear
- warehouse/stock updates do not feel fragile
- mobile stock screens remain responsive

## 4. Sales posting from custom POS

Validate:

- create sale in Flutter POS
- store locally
- replay through integration boundary
- create corresponding ERPNext-side sales record
- confirm success is reflected back on device

Success criteria:

- no duplicate sales
- clear accepted/rejected replay outcomes
- cashier flow does not become slower or more complex

## 5. Payment posting and customer due reduction

Validate:

- capture payment from mobile
- post to integration layer
- create ERPNext-side payment/accounting effect
- verify updated due balance returns to projections

Success criteria:

- balances reduce correctly
- failure cases are visible
- recovery path remains clear

## 6. Purchase and supplier back-office flow

Validate:

- create supplier
- create purchase document
- receive stock
- observe stock and cost consequences

Success criteria:

- purchase flow in ERPNext clearly beats the custom implementation burden

## 7. Baseline accounting/reporting value

Validate:

- daily sales reporting
- payment visibility
- basic receivable/payable visibility
- accounting-ledger usefulness for the owner/admin

Success criteria:

- ERPNext provides obvious operational value here

## Non-negotiable UX checks

Even if ERPNext fits functionally, reject the approach if it damages these:

- POS feels slower
- scanner flow becomes awkward
- offline behavior becomes unreliable
- customer due collection becomes harder on mobile
- support/recovery flows become more confusing

## Decision checklist

At the end of the proof of concept, answer these questions:

### Product fit

- Does ERPNext cover the important back-office domains well enough?
- Are the missing pieces small customizations or major rewrites?

### Technical fit

- Can Business Hub keep its local-first mobile execution model cleanly?
- Is the integration boundary understandable and supportable?

### Operational fit

- Does the team gain maturity in accounting, stock, and purchasing?
- Is support easier or harder?

### UX fit

- Did cashier speed remain strong?
- Did mobile usage become more complicated?

## Go / no-go thresholds

### Go

Proceed if all are true:

- ERPNext clearly improves accounting/back-office maturity
- mobile/POS UX remains strong
- integration boundary is understandable
- no unacceptable offline compromise appears

### No-go

Do not proceed if any are true:

- the team would still need to rebuild most flows anyway
- ERPNext weakens daily shop-floor speed
- sync and ownership become messy
- the proof of concept exposes more integration burden than expected

## Recommended delivery sequence after a successful proof of concept

If the proof of concept succeeds, roll out in this order:

1. customer and item master sync
2. stock and warehouse authority
3. supplier and purchase workflows
4. accounting and finance
5. sales/payment ERP posting from Flutter POS
6. selective retirement of custom back-office modules

## Deliverables from the proof of concept

The team should produce:

- one written outcome summary
- one fit-gap decision sheet
- one integration boundary map
- one risk register
- one final recommendation

## Final note

The proof of concept is successful only if it answers the architectural question quickly.

It is **not** a success if it becomes a hidden full migration project.

## Reference links

- [ERPNext Homepage](https://erpnext.com/homepage)
- [ERPNext Documentation](https://docs.erpnext.com/)
- [ERPNext GitHub Repository](https://github.com/frappe/erpnext)
- [ERPNext Supported Versions](https://github.com/frappe/erpnext/wiki/Supported-Versions)
