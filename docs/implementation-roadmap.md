# Business Hub Implementation Roadmap

## Purpose

This document turns the approved Business Hub target architecture into a phase-by-phase execution plan.

Use this file as the delivery roadmap for:

- product sequencing
- engineering implementation
- migration planning
- rollout readiness
- cutover governance

The authoritative target architecture remains in [Business Hub Complete Platform Handbook](./business-hub-complete-platform-handbook.md).

This roadmap defines how we get there without breaking the live business.

## Planning assumptions

- current production reality still depends heavily on Firebase and client-local SQLite
- Flutter is the future mobile path
- Next.js is the future web/admin path
- Django + DRF + PostgreSQL is the future core backend
- migration must follow a strangler pattern, not a hard cutover
- one domain can only have one write master at a time
- financial facts must be append-only and auditable
- offline clients reconnect by replaying commands, not overwriting records

## Success definition

The roadmap is successful when Business Hub reaches all of the following:

- Flutter mobile is the default high-performance mobile app
- Next.js admin is the primary operator surface
- Django + PostgreSQL owns core business writes
- Firebase no longer acts as the long-term system of record
- inventory, customers, sales, payments, and ledgers reconcile cleanly
- offline/mobile flows recover safely after disconnects
- operations, tracing, and rollback are production-ready

## Delivery principles

- optimize for safe cutover, not fast cutover
- move domain by domain
- prove parity before shifting traffic
- do not trust client clocks as truth
- keep derived totals out of direct client write paths
- ship observability and rollback controls before risky migrations
- keep the old system alive until the new one has earned trust

## Main workstreams

The roadmap runs across five workstreams in parallel:

- `Platform`: Django, DRF, PostgreSQL, Redis, Celery, Terraform, OpenTelemetry
- `Mobile`: Flutter app, local SQLite, offline outbox, sync UX, POS performance
- `Web/Admin`: Next.js admin shell, reconciliation tools, ops dashboards, migration controls
- `Data`: schema design, backfill, bridge, shadow verification, projections
- `Operations`: CI/CD, tracing, alerting, disaster recovery, load testing, rollback drills

## Domain cutover order

Recommended domain order:

1. shop settings and metadata
2. inventory catalog and inventory private data
3. customers and customer balances
4. expenses and attendance
5. sales, payments, and stock ledger
6. reports, analytics, and remaining Firebase-dependent utilities

This order intentionally moves the highest-trust financial flows later.

## Phase 1: Platform Foundation

### Goal

Stand up the new platform skeleton so every future domain has a stable home.

### Primary scope

- PostgreSQL schema foundation
- Django project and module boundaries
- DRF API foundations
- Redis and Celery foundations
- object storage strategy
- Flutter local SQLite foundation
- Next.js admin shell foundation
- OpenTelemetry baseline
- Terraform/Pulumi baseline

### Deliverables

- Django monolith or modular monolith with domain apps:
  - users
  - shops
  - memberships
  - inventory
  - customers
  - sales
  - payments
  - expenses
  - attendance
  - jobs
  - audit
- PostgreSQL base schema with keys, constraints, timestamps, audit columns, and source IDs
- DRF auth, pagination, versioning, error shape, idempotency conventions
- Redis configured for cache, coordination, and worker support
- Celery worker base with health checks
- OpenTelemetry trace propagation from frontend to backend
- Terraform/Pulumi project structure for repeatable environments
- Flutter mobile local DB bootstrap and repository pattern
- Next.js admin auth shell and navigation shell

### Exit criteria

- local developer stack runs end-to-end
- CI can spin up backend services and run basic tests
- traces are visible for API requests and worker tasks
- at least one pilot domain can perform create/read/update/delete against PostgreSQL in dev
- Flutter and Next.js can authenticate against the new backend foundations

### Key risks to control

- over-designing microservices too early
- skipping observability because "it is only phase 1"
- importing legacy Firebase assumptions directly into relational models

## Phase 2: Data and Migration Backbone

### Goal

Build the migration machinery that lets old and new systems coexist safely.

### Primary scope

- Firebase snapshot backfill into PostgreSQL
- domain ownership service
- domain epoch policy
- unidirectional live bridge per domain
- projection tables and summary tables
- shadow verification dashboards

### Deliverables

- Firebase-to-PostgreSQL backfill jobs
- source mapping tables and origin metadata
- domain ownership registry:
  - domain
  - write master
  - current epoch
  - bridge mode
- live bridge with strict per-domain write direction
- projection refresh jobs for dashboard and reporting summaries
- mismatch dashboards comparing Firebase and PostgreSQL by shop, day, and domain
- replay-safe idempotency model for migrated facts and commands

### Exit criteria

- backfill can be re-run safely without duplicate corruption
- at least one pilot domain can mirror data continuously
- shadow verification highlights mismatches before any customer-facing cutover
- reconnect logic rejects or routes stale mutable updates correctly
- append-only fact replay works with audit visibility

### Key risks to control

- accidental bidirectional write ownership
- bridge loops caused by missing origin metadata
- hidden duplicates during backfill
- summary/projection drift from source facts

## Phase 3: Pilot Domain Cutovers

### Goal

Cut over low-to-medium-risk domains first and prove the migration pattern in production.

### Primary scope

- pilot cutovers for early domains
- reconciliation dashboard
- legacy client compatibility policy
- rollback drills
- first real business users on the new path

### Deliverables

- feature flags controlling reads and writes by domain, shop, and surface
- reconciliation dashboard in Next.js admin for:
  - mismatch review
  - stale client rejection review
  - bridge health
  - manual approval or rejection where needed
- documented legacy client policy:
  - supported versions
  - degraded behavior rules
  - forced upgrade triggers
- rollback runbook for pilot domains
- production pilot cutover for:
  - shop settings
  - inventory
  - customers

### Exit criteria

- pilot domains run on PostgreSQL with acceptable mismatch rates
- rollback is tested, timed, and documented
- support/admin team can inspect reconciliation issues without engineering intervention
- Flutter and web clients can survive stale reconnect cases gracefully
- no silent corruption is observed in pilot shops

### Key risks to control

- weak rejection UX on mobile for stale updates
- owners or admins lacking tools to resolve reconciliation items
- turning off the legacy path before pilot stability is proven

## Phase 4: Core Commerce Cutovers

### Goal

Move the most critical business flows onto the new platform without compromising trust.

### Primary scope

- sales cutover
- payments cutover
- stock ledger cutover
- stronger queue and worker topology
- read replicas if justified
- regional scaling if justified

### Deliverables

- command-based sales and payment ingestion on the new backend
- stock movement ledger and projection rebuild strategy
- stronger worker topology for:
  - imports
  - exports
  - reconciliation
  - projection refresh
  - heavy reporting
- POS offline outbox rules for sales and payment replay
- regional deployment hardening if Mumbai-only deployment becomes insufficient
- read replica plan if read pressure begins to justify it

### Exit criteria

- sales, payments, and stock ledgers reconcile to acceptable financial tolerance
- offline-to-online POS recovery is proven on real devices
- no last-write-wins behavior remains in critical domains
- worker throughput supports real production usage with headroom
- support team can diagnose cutover issues through traces, dashboards, and reconciliation tools

### Key risks to control

- price mismatch policies not being explicit
- accepting stale mutable inventory writes after domain ownership moved
- treating counters as truth instead of deriving them from facts

## Phase 5: Retirement and Hardening

### Goal

Finish the transition, remove legacy dependencies, and lock the new platform into normal operations.

### Primary scope

- retire Firebase dependencies
- remove legacy compatibility code
- formalize steady-state operations
- finish production hardening

### Deliverables

- Firebase downgraded to archive, bridge source, or fully retired state as appropriate
- removed legacy domain write paths
- finalized DRF API contracts and mobile/web client contracts
- production runbooks for:
  - incidents
  - rollback
  - disaster recovery
  - cost monitoring
  - scaling triggers
- final load testing and recovery drills
- final parity signoff for mobile, web, and backend

### Exit criteria

- core domains no longer depend on Firebase as operational truth
- legacy compatibility paths are removed or explicitly quarantined
- production SLOs, dashboards, alerts, and DR targets are active
- launch readiness is signed off by product, engineering, and operations

### Key risks to control

- leaving “temporary” dual-write logic in place forever
- carrying hidden Firebase fallback paths into the final platform
- assuming retirement is complete before audits and parity checks are closed

## Phase 6: Go-Live and Hypercare

### Goal

Execute the real launch window, keep the platform under controlled hypercare, and hand it off into steady-state operations without losing rollback discipline.

### Primary scope

- final go-live execution
- hypercare monitoring window
- steady-state handoff
- launch rollback governance

### Deliverables

- go-live readiness board
- durable go-live checkpoint journal
- hypercare operator checklist
- steady-state handoff runbook
- launch rollback triggers and ownership map

### Exit criteria

- final launch approval has been executed, not just recorded
- hypercare window completes without unresolved critical drift
- rollback criteria remain green throughout the monitoring window
- steady-state ownership is explicitly handed off to normal operations

### Key risks to control

- treating Phase 5 approval as the same thing as real go-live execution
- ending hypercare before the reconciliation surface is quiet
- letting the launch window close without a durable handoff decision

## Cross-phase non-negotiables

- every write path must be idempotent
- every migrated row must preserve source-system traceability
- every risky cutover must have feature-flag rollback
- every domain must have an explicit write owner
- every financial or inventory mismatch must be reviewable
- every major service must emit telemetry
- every phase must end with a written go/no-go review

## Suggested execution order by team

If the team works in parallel, the recommended sequencing is:

1. platform team completes Django/PostgreSQL/Redis/Celery foundations
2. data team completes schema map, backfill, bridge, and shadow verification
3. web/admin team builds reconciliation and operations surfaces
4. Flutter team builds local-first mobile flows against the new contracts
5. cutover team executes domain-by-domain rollout with rollback discipline

## Recommended phase gates

Before moving to the next phase, the team should explicitly approve:

- architecture gate
- schema gate
- migration safety gate
- pilot cutover gate
- financial reconciliation gate
- legacy retirement gate
- go-live handoff gate

## Recommended timeboxing

The exact timeline depends on team size, but a reasonable planning shape is:

- Phase 1: 3 to 5 weeks
- Phase 2: 3 to 5 weeks
- Phase 3: 4 to 6 weeks
- Phase 4: 4 to 8 weeks
- Phase 5: 2 to 4 weeks
- Phase 6: 1 to 2 weeks

This should be treated as a sequencing estimate, not a promise.

## When Tier B starts

Tier B work should begin only when Tier A is stable and one or more of these become true:

- read pressure consistently justifies replicas
- queue throughput becomes a real bottleneck
- regional latency materially hurts operators
- reporting/query load threatens the primary transactional path
- workflow orchestration becomes too complex for simple job queues

Until then, Business Hub should stay focused on a clean Tier A rollout.

## Final roadmap verdict

This is the approved execution path for Business Hub:

- build the new platform foundations first
- migrate safely in parallel
- cut over domain by domain
- move the financial core only after pilot trust is earned
- retire Firebase only after parity is proven
- execute go-live under hypercare before declaring steady state

The architecture is only as good as the migration discipline behind it.

This roadmap is designed to keep Business Hub fast, safe, and commercially stable while the platform evolves.
