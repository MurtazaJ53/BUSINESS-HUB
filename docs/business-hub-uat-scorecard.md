# Business Hub UAT Scorecard

## Purpose

This scorecard is the controlled acceptance gate before broader rollout.

It tests whether Business Hub feels like a clear product by role and plan, not just whether APIs return data.

## Test groups

- cashier
- manager
- owner
- support admin

## Environment rules

- one pilot workspace prepared
- one Starter workspace prepared
- one Growth workspace prepared
- one Pro workspace prepared
- role accounts prepared for each flow

## Cashier acceptance

- can land on the right primary screen
- can search or scan products
- can add items quickly
- can attach a customer
- can save a sale
- can review a recent receipt
- does not see owner/admin clutter

Result:

- pass / fail

## Manager acceptance

- can monitor stock
- can review customer balances
- can use filters in customers/history/inventory
- can access expenses and attendance when enabled
- does not see hidden internal pages

Result:

- pass / fail

## Owner acceptance

- can understand dashboard posture quickly
- can review plan posture
- can see upgrade path clearly
- can access richer summaries only when allowed by plan
- product language stays outcome-first

Result:

- pass / fail

## Support acceptance

- can verify workspace plan and feature exposure
- can identify product vs plan vs ERP-backed issue
- can use hidden controls without client-facing confusion

Result:

- pass / fail

## Product boundary checks

- no normal client sees migration page
- no normal client sees ERPNext page
- no Starter workspace sees Growth or Pro operations by mistake
- no lighter plan sees finance-only summaries by mistake

Result:

- pass / fail

## UAT exit rule

UAT passes only if:

- all roles complete their core journeys
- plan boundaries behave correctly
- no hidden internal surface leaks into normal product use
- no major confusion requires ERP explanation
