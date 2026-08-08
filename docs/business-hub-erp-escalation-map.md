# Business Hub ERP Escalation Map

## Purpose

This document defines how ERP-backed issues are escalated internally without exposing ERP complexity to the client.

## Core rule

Business Hub remains the client conversation.

ERP or platform detail stays inside the support and engineering chain.

## Escalation path

### Step 1: Product support confirms client-visible impact

Questions:

- what role saw it
- what task failed
- is selling blocked
- is reporting wrong
- is payment follow-up wrong

### Step 2: Operational support classifies the issue

Classify as one of:

- product UX issue
- plan/permission mismatch
- Business Hub data issue
- ERP-backed finance issue
- ERP-backed purchasing issue
- sync/integration issue

### Step 3: Platform owner receives ERP-backed issues

Send:

- workspace
- plan tier
- role
- exact product task
- business impact
- linked records if known
- whether rollback/workaround exists

## ERP-backed issue classes

### Finance-backed

Examples:

- payment totals do not match
- collection summary is missing expected finance fields
- sales posting mismatch

Primary owner:

- backend/platform owner

### Purchasing-backed

Examples:

- supplier context missing
- purchase detail missing for Pro workspace
- ERP purchase sync mismatch

Primary owner:

- inventory or ERP integration owner

### Binding or environment

Examples:

- workspace not linked correctly
- ERP control page indicates failed connection
- cycle tasks fail consistently

Primary owner:

- platform admin

## Client-safe update language

Use:

- we are reviewing the connected back-office record
- the workspace integration layer needs correction
- we are confirming the finance-side record path

Avoid:

- Sales Invoice validation failed
- Payment Entry mapping is broken
- DocType fetch returned the wrong schema

## Escalation acceptance

This map is ready when:

- support always knows who owns ERP-backed classes
- clients never need ERP vocabulary to understand status
- platform owners receive enough detail to act immediately
