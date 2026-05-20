# Business Hub Frappe / ERPNext Weekly Implementation Plan

## Purpose

This document defines the practical implementation plan for the recommended Business Hub product strategy:

- **Business Hub** remains the client-facing product
- **Business Hub backend** remains the only application boundary for mobile and web clients
- **Frappe** becomes the hidden platform foundation
- **ERPNext** is used selectively for back-office depth, not as the default client UI

The goal is to ship a clean, commercially sensible product without exposing raw ERP complexity to normal clients.

## Core product decision

Business Hub clients should not receive the full ERPNext surface by default.

They should receive a curated product with only the workflows they actually need:

- POS
- inventory
- customers
- dues and collections
- expenses
- attendance
- reports
- simple settings

ERP-heavy capability should stay hidden or plan-gated:

- accounting internals
- journals
- tax setup
- account mappings
- raw purchase/accounting documents
- stock valuation internals
- ERP bindings and sync controls

## Strategic model

### Business Hub is the product

Business Hub should own:

- product identity
- UX
- pricing and packaging
- roles and permissions
- mobile and admin workflows
- feature flags
- support and training language

### Frappe is the application platform

Frappe should be used for:

- custom app structure
- custom DocTypes where Business Hub needs domain control
- server-side business services
- API exposure behind Business Hub adapters
- workflow and permission support where useful

### ERPNext is optional back-office acceleration

ERPNext should be used only where it provides clear leverage:

- accounting
- purchasing
- supplier workflows
- receivables and payables
- stock ledger discipline
- reconciliation-heavy back-office operations

## Product packaging model

### Starter

Client sees:

- POS
- inventory
- customers
- dues
- daily reporting

Internal hidden layers may still use Frappe/ERPNext under the hood.

### Growth

Client sees everything in Starter plus:

- expenses
- attendance
- supplier basics
- purchase requests or simple purchase flow
- better reporting

### Pro

Client sees everything in Growth plus selected advanced business controls:

- multi-branch visibility
- approval flows
- advanced reporting
- finance-facing features approved for that account

### Internal only

Never expose broadly unless there is a very explicit business reason:

- ERPNext setup forms
- account tree
- journal entry UI
- tax internals
- payment account mapping
- technical sync diagnostics
- binding configuration
- migration and ops tooling

## Delivery principles

1. **One product boundary**
- Mobile and admin web talk only to Business Hub backend.

2. **No direct client-to-ERP access**
- No mobile or web client should call Frappe or ERPNext directly.

3. **Feature flag everything advanced**
- Any advanced back-office or ERP-powered capability must be gated by plan and role.

4. **Business task first**
- Every client-visible screen must map to a real shop task, not an ERP concept.

5. **Back-office complexity stays hidden**
- ERP depth is allowed under the hood, not in the default product face.

## Delivery workstreams

This plan runs across five workstreams:

1. Product and UX boundary
2. Backend domain and adapter layer
3. Frappe platform foundation
4. ERPNext selective back-office integration
5. Packaging, rollout, and support readiness

## Week-by-week plan

## Week 1: Product boundary freeze

### Goal

Lock what Business Hub clients will and will not see.

### Main outputs

- final client-facing module list
- hidden back-office module list
- internal-only module list
- role map:
  - cashier
  - manager
  - owner
  - support admin
  - platform admin
- Starter / Growth / Pro packaging draft

### Acceptance criteria

- every module is assigned to one of:
  - client-facing
  - hidden back-office
  - internal-only
- no raw ERPNext screens are part of the default client UI promise

## Week 2: Domain ownership map

### Goal

Define which business domains stay Business Hub native, which are Frappe-backed, and which are ERPNext-backed.

### Main outputs

- ownership map for:
  - products
  - customers
  - sales
  - payments
  - dues
  - inventory
  - expenses
  - attendance
  - suppliers
  - purchases
  - accounting
  - reporting
- authoritative system decision per domain
- read/write flow decision per domain

### Recommended ownership

- Business Hub native first:
  - POS
  - mobile checkout
  - customer collection UX
  - owner dashboard UX
  - role-aware settings UX
- Frappe-backed:
  - Business Hub custom service layer
  - custom curated business workflows
- ERPNext-backed:
  - purchasing
  - supplier finance
  - accounting
  - heavy stock/back-office discipline

### Acceptance criteria

- each domain has one source of truth
- no domain has two uncontrolled writers

## Week 3: Backend boundary contract

### Goal

Freeze the Business Hub API contract that all clients will use, regardless of what sits behind it.

### Main outputs

- Business Hub service contract for:
  - products
  - customers
  - sales
  - payments
  - dues
  - inventory
  - expenses
  - attendance
  - suppliers
  - purchases
  - reports
- adapter interfaces:
  - BusinessHubCoreAdapter
  - FrappeAdapter
  - ERPNextFinanceAdapter
- feature-flag keys for plan-gated modules

### Acceptance criteria

- Flutter and admin web can continue to target one stable backend API
- ERP/Frappe implementation can evolve behind that boundary

## Week 4: Frappe foundation setup

### Goal

Set up the Frappe-side foundation for curated Business Hub modules without exposing generic ERP UI.

### Main outputs

- Frappe app structure for Business Hub
- custom DocType plan where needed
- naming and namespace rules
- permission and role mapping to Business Hub roles
- environment and deployment baseline

### Acceptance criteria

- Business Hub custom app can live cleanly on Frappe
- roles map cleanly between Business Hub and Frappe

## Week 5: Client-facing core module pass

### Goal

Make sure the default product promise is strong before deep ERP work continues.

### Main outputs

- polished client-facing flows for:
  - POS
  - inventory
  - customers
  - dues
  - simple reports
- reduced complexity in settings and admin views
- feature gates for hidden modules

### Acceptance criteria

- a normal shop client can operate daily work without touching ERP concepts
- no ERP-heavy terms leak into standard cashier or owner flows

## Week 6: Owner and manager layer

### Goal

Add the business management layer without exposing accounting internals.

### Main outputs

- owner dashboard requirements
- manager-level summary views
- daily closing summary
- due collections view
- simple stock risk alerts
- simple expense summary

### Acceptance criteria

- owner gets business visibility without ERP complexity
- manager workflows remain shorter than ERP equivalents

## Week 7: Operations and staff layer

### Goal

Complete the curated operations layer for non-ERP daily business use.

### Main outputs

- attendance and staff basics
- expense workflows
- supplier basics if needed for Growth tier
- support-admin hidden controls

### Acceptance criteria

- Growth tier is operable without exposing full ERP workflows

## Week 8: ERPNext selective integration

### Goal

Limit ERPNext use to the places where it has clear leverage.

### Main outputs

- ERPNext integration enabled only for:
  - purchasing
  - supplier payments
  - accounting-facing entries
  - stock reconciliation
- clear internal-only admin surfaces for ERP operations
- no default client navigation entry to raw ERPNext

### Acceptance criteria

- ERPNext is functioning as a hidden engine, not a visible product layer
- Business Hub still controls user experience

## Week 9: Feature-flag and plan enforcement

### Goal

Make packaging real, not just conceptual.

### Main outputs

- Starter / Growth / Pro feature flags
- role and plan enforcement in backend
- UI hide/show behavior by role and plan
- tenant-level configuration rules

### Acceptance criteria

- Starter clients cannot accidentally see Pro or internal-only features
- internal tools remain restricted

## Week 10: Pilot implementation

### Goal

Test the curated Business Hub model with one real or demo shop.

### Main outputs

- one pilot tenant with proper tier setup
- one cashier journey
- one manager journey
- one owner journey
- one hidden admin/ERP operations journey

### Acceptance criteria

- pilot users can perform normal work without ERP confusion
- admin/support can still reach hidden controls when needed

## Week 11: UAT and support packaging

### Goal

Prepare the product for controlled rollout, training, and pricing communication.

### Main outputs

- client training pack by role
- support playbooks
- packaging sheet:
  - Starter
  - Growth
  - Pro
- internal escalation map for ERP-backed issues

### Acceptance criteria

- support can explain the product without mentioning ERP internals
- sales can describe plans in outcome language, not software-menu language

## Week 12: Go-live readiness review

### Goal

Decide whether the curated Business Hub product is ready for controlled release.

### Main outputs

- go-live scorecard
- packaging and pricing approval
- role/feature audit
- ERP isolation audit
- support readiness check

### Acceptance criteria

- client-facing experience is clearly Business Hub, not ERPNext
- hidden back-office tools are operational
- support and rollout teams know what is visible and what stays hidden

## Delivery checklist by layer

## Product layer

- module list frozen
- navigation simplified
- client screens mapped to business tasks
- plan tiers defined

## Backend layer

- one Business Hub API contract
- one owner per domain
- feature flags implemented
- adapter boundaries defined

## Frappe layer

- Business Hub app scaffolded
- curated DocType strategy defined
- permissions aligned to Business Hub roles

## ERPNext layer

- advanced back-office modules integrated selectively
- no uncontrolled client exposure
- all ERP-facing features role-gated

## Commercial layer

- Starter / Growth / Pro packaging finalized
- support and training paths prepared
- pilot account configured cleanly

## Success metrics

This plan is successful when all of the following are true:

- normal clients do not need ERPNext training
- Business Hub remains the visible product identity
- support burden is lower than a raw ERP rollout
- advanced ERP value is still captured behind the scenes
- packaging is clear enough to sell and support confidently

## Recommended next action after this plan

Immediately execute these three artifacts:

1. `client-facing module matrix`
2. `domain ownership matrix`
3. `Starter / Growth / Pro feature matrix`

Those three decisions should be treated as the Week 1 and Week 2 hard gates before deeper Frappe/ERPNext implementation expands further.
