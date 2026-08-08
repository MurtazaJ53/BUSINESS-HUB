# Business Hub Role-Based Training Pack

## Purpose

This pack defines how Business Hub should be taught to real client users without exposing ERP or internal platform complexity.

The rule is simple:

- train people on **their job**
- do not train them on **the software stack**

## Training principles

1. Teach by role, not by feature list.
2. Use business language, not system language.
3. Keep every session task-based.
4. Hide internal-only tools from all client training.
5. Treat ERP-backed logic as invisible plumbing.

## Training format by role

### Cashier

Training length:

- 30 to 45 minutes

Core tasks:

- sign in
- start selling
- search and scan products
- attach a customer
- take payment
- review a recent receipt
- handle simple sync retry awareness

Must not include:

- settings internals
- plan tiers
- ERP or migration wording
- advanced ops

Pass rule:

- cashier can complete a normal sale without help in under 3 minutes

### Manager

Training length:

- 45 to 60 minutes

Core tasks:

- all cashier tasks
- review stock watch
- review customer balances
- use history and filters
- record expenses if enabled
- review attendance if enabled
- use settings safely

Must not include:

- ERP control surfaces
- migration tools
- internal platform diagnostics

Pass rule:

- manager can supervise one full shift without needing hidden support tools

### Owner

Training length:

- 60 to 75 minutes

Core tasks:

- review dashboard
- review customers, sales, and payments
- understand current plan
- understand when to upgrade
- review business posture and daily follow-up

Must not include by default:

- ERPNext UI
- journal/account-tree explanations
- raw finance internals

Pass rule:

- owner can explain what Business Hub gives today and what the next plan unlocks

### Support admin

Training length:

- 60 to 90 minutes

Core tasks:

- troubleshoot user-visible issues
- verify workspace plan and features
- guide sync recovery
- use hidden support surfaces safely
- escalate ERP-backed failures correctly

Pass rule:

- support admin can resolve normal product issues without exposing internal tools to clients

### Platform admin

Training length:

- 90 minutes plus environment walkthrough

Core tasks:

- feature flags
- migration surfaces
- ERP bindings
- internal control planes
- go-live and rollback support

Pass rule:

- platform admin can operate internal-only surfaces without blurring product boundaries

## Training assets to prepare

- cashier quick-start sheet
- manager daily operations sheet
- owner plan and reporting sheet
- support troubleshooting guide
- platform admin operations guide
- short role-based demo recordings

## Session checklist

- correct role account prepared
- correct plan tier prepared
- non-relevant modules hidden
- sample data loaded
- one realistic task sequence demonstrated
- one realistic task sequence repeated by trainee

## Do not say this in client training

- DocType
- journal entry
- account mapping
- migration state
- ERP binding
- platform admin
- control plane

## Say this instead

- products
- receipts
- customer balances
- team attendance
- expenses
- workspace plan
- support will unlock it when your plan includes it

## Training acceptance

Training is ready when:

- each role has a short task-based script
- no client-facing training needs ERP vocabulary
- screenshots match the actual curated product surfaces
- support can reuse the same language as sales and onboarding
