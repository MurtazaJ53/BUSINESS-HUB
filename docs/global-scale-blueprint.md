# Business Hub Global Scale Blueprint

## Purpose

This document defines the path from the current app state to a global-scale, security-hardened, operationally reliable platform.

The goal is not "infinite scale". The real goal is:

- predictable performance under very high load
- graceful degradation instead of freezes or blank screens
- safe bulk imports and background processing
- strong security boundaries
- measurable scale targets per phase
- clear operational visibility when something goes wrong

## Current State

The current release already improved large local-data handling in these areas:

- paged history reads
- paged customer reads
- paged expense reads
- batched reactive updates
- better SQLite indexes
- lower POS lookup cost
- lighter dashboard chart queries
- safer import-related audit behavior

That means the app is now much more stable for large local data than before.

## Current Bottlenecks Still Open

These are the main scale blockers still visible in the codebase:

1. `src/pages/Analytics.tsx`
Still depends too much on raw in-memory transaction processing.

2. `src/pages/Inventory.tsx`
Still loads the full catalog and derives heavy view state in the client.

3. `src/pages/Team.tsx`
Still behaves like a "load a lot, filter in UI" module for staff, attendance, and payroll-adjacent views.

4. `functions/src/index.ts`
Global function defaults are still small for serious traffic:
- region: `us-central1`
- `maxInstances: 5`
- `cpu: 0.167`
- `memory: 256MiB`

5. `firestore.rules`
Permission checks still rely on document lookups in helper functions such as `isMember`, `isAdmin`, and `can`, which is workable but not ideal for very high scale and frequent access.

## Architecture We Should Move To

### 1. Frontend

The frontend should become a thin, fast operational shell:

- render paged data only
- never compute heavy analytics from raw rows in React
- never block the main thread on imports, reports, or payroll
- keep all large lists virtualized
- keep filters server-backed or DB-backed

### 2. Local Store

SQLite should remain the offline-first operational cache for the device:

- fast local writes
- local reads for current working windows
- retryable sync outbox
- conflict-safe merge strategy
- data retention tiers to prevent unlimited device growth

### 3. Operational Backend

Firestore should hold operational app data:

- shops
- sales
- sale_items
- payments
- customers
- staff
- stock movements
- attendance
- imports
- audit events

But Firestore should not be the main engine for heavy analytics.

### 4. Background Compute Layer

Heavy work must move to workers and queued jobs:

- import parsing
- validation
- aggregate updates
- report generation
- payroll summaries
- velocity recompute
- nightly data compaction
- anomaly detection

Recommended stack:

- Cloud Functions or Cloud Run for execution
- Cloud Tasks or Pub/Sub for queueing
- idempotent job handlers
- dead-letter handling for failed jobs

### 5. Analytics Store

For true scale, use a separate analytics layer:

- Firestore for operational reads and writes
- BigQuery or managed SQL for analytics and long-range reporting

This split is what keeps POS fast while reports still remain deep and accurate.

## Data Model Direction

### Raw Collections

Keep raw operational records append-friendly:

- `shops/{shopId}/sales/{saleId}`
- `shops/{shopId}/sale_items/{itemId}`
- `shops/{shopId}/payments/{paymentId}`
- `shops/{shopId}/customers/{customerId}`
- `shops/{shopId}/inventory/{itemId}`
- `shops/{shopId}/staff/{staffId}`
- `shops/{shopId}/attendance/{attendanceId}`
- `shops/{shopId}/expenses/{expenseId}`
- `shops/{shopId}/audit/{eventId}`
- `shops/{shopId}/imports/{importJobId}`

### Aggregate Collections

Add precomputed collections for screens that need fast totals:

- `shops/{shopId}/aggregates/daily_metrics_{yyyyMMdd}`
- `shops/{shopId}/aggregates/monthly_metrics_{yyyyMM}`
- `shops/{shopId}/aggregates/payment_mix_{yyyyMMdd}`
- `shops/{shopId}/inventory_velocity/{itemId}`
- `shops/{shopId}/customer_credit_summary/{customerId}`
- `shops/{shopId}/staff_payroll_summary/{staffId}_{yyyyMM}`
- `shops/{shopId}/stock_alert_summary/current`
- `shops/{shopId}/dashboard_snapshot/current`

### Job Collections

Add explicit background job tracking:

- `shops/{shopId}/jobs/{jobId}`
- `shops/{shopId}/imports/{importJobId}/errors/{errorId}`
- `shops/{shopId}/exports/{exportJobId}`

Every large asynchronous operation should become a job with:

- status
- progress percent
- createdBy
- startedAt
- finishedAt
- retryCount
- errorSummary

## Hot / Warm / Cold Data Strategy

To prevent device bloat and expensive client sync:

- hot data: last `30-90` days on-device by default
- warm data: `3-12` months queryable on demand
- cold data: archived history for long-range lookup and reports

The UI should default to hot data and fetch older slices only when requested.

## Scale Work By Module

### Inventory

Required changes:

- replace full-catalog reads with paged reads
- add cursor-based pagination
- add indexed search by `name`, `sku`, `category`, `barcode`
- virtualize the list/grid
- lazy-load item detail modals
- move stock velocity and turnover to aggregate tables
- split stock movement history from main item listing

Target outcome:

- smooth browsing with `50k+` SKUs per shop
- search response in low hundreds of milliseconds
- no catalog-wide rerender after a single stock change

### Analytics

Required changes:

- stop deriving charts from raw sales arrays in the browser
- create daily, weekly, monthly aggregate writers
- materialize margin, revenue, item velocity, staff productivity, and payment mix
- move large date-range report generation to background jobs
- add export caching for repeated report requests

Target outcome:

- dashboards load from summary documents
- large date-range reports do not block the UI
- analytics remains usable with millions of historical rows

### Team

Required changes:

- paginate staff directory
- paginate attendance history
- paginate payroll history
- precompute monthly payroll summaries
- split raw attendance from payroll snapshots
- move payout calculations to backend jobs

Target outcome:

- `5L+` total staff across the platform becomes realistic
- per-shop staff pages stay fast even with large attendance history

### POS and Checkout

Required changes:

- keep barcode lookup indexed locally
- keep pricing and stock reads map-backed
- reserve stock update fan-out for background sync if needed
- add local queue durability for interrupted sales
- add retry-safe payment intent handling if online gateways expand

Target outcome:

- checkout remains sub-second for common sales
- temporary sync delays do not block billing

### History and Ledgers

Required changes:

- keep pagination
- move advanced filters to indexed queries only
- add server-generated or cached export files for large ranges
- separate receipt view from listing payloads

Target outcome:

- imported historical data remains browsable without freezing

## Import Pipeline Blueprint

The import system must become a proper job pipeline.

### Current Problem

Large imports still put too much responsibility on the client.

### Target Flow

1. User uploads file.
2. App creates import job metadata.
3. Backend worker parses file.
4. Validation runs in chunks.
5. Valid rows are written in batches.
6. Aggregates update asynchronously.
7. UI watches progress only.
8. Final report shows success count, failure count, and downloadable error rows.

### Required Features

- chunked parsing
- idempotent row keys
- duplicate detection
- retry-safe writes
- partial success support
- cancel support before commit stage
- post-import aggregate refresh
- audit event generation

## Sync and Concurrency Strategy

For high global concurrency, we need stronger control over write patterns.

### Requirements

- outbox-based local writes remain the default
- every mutation has an idempotency key
- stock changes use append-only movement records plus materialized current stock
- avoid hotspot writes to the same aggregate documents
- shard counters where needed
- bucket aggregate writes by date and shop
- isolate shop workloads so one busy tenant does not degrade others

### Conflict Handling

Define explicit conflict classes:

- stock conflict
- customer balance conflict
- staff permission conflict
- duplicate sale submission
- retry after partial sync

Each class should have deterministic merge rules.

## Security Blueprint

### Authentication and Authorization

Move toward:

- Firebase Auth with stronger custom claims discipline
- fewer Firestore-rule document lookups per request
- privileged writes only through backend endpoints where possible
- role and permission snapshots embedded into tokens and refreshed intentionally

### App Protection

Add:

- Firebase App Check for all client-facing services
- API rate limits
- abuse detection for import, PIN, auth, and report endpoints
- device/session telemetry for suspicious access

### Sensitive Data Protection

Add:

- encrypted backups
- least-privilege service accounts
- secret rotation policy
- environment separation for dev, staging, prod
- field-level segregation for high-sensitivity data

### Audit and Forensics

Must log:

- login and device changes
- PIN changes
- staff permission changes
- large imports
- voided sales
- balance overrides
- payroll approvals
- reconciliation mismatches
- failed privileged actions

## Reliability and Operations Blueprint

### Observability

Add centralized monitoring for:

- frontend crashes
- blank-screen sessions
- slow screen loads
- sync queue depth
- import queue depth
- worker retry count
- function latency
- Firestore read/write cost
- failed permission checks

### SLOs

Define concrete targets:

- POS save: `p95 < 800ms` locally
- screen open for paged lists: `p95 < 1.5s`
- dashboard snapshot load: `p95 < 1.0s`
- import progress start visible: `p95 < 5s`
- crash-free sessions: `> 99.9%`

### Release Safety

Add:

- staging environment
- production environment
- feature flags
- rollback procedure
- schema migration playbook
- backup restore drills

## Load Testing Blueprint

We should not claim high-scale readiness until these tests exist.

### Per-Shop Tests

- `100k+` imported historical receipts
- `100k+` daily transactions simulated
- `100k+` mini-transactions or line items
- `10k-50k` inventory items
- `10k-100k` customers
- `1k+` staff records in a heavy tenant

### Platform Tests

- `1k`, `10k`, and `100k` concurrent active sessions
- large fan-out import activity across many shops
- peak-hour sale write bursts
- background aggregate lag under burst load
- worker retry storms

### Failure Mode Tests

- offline to online sync flood
- duplicate submission storms
- partial import failure
- worker crash mid-import
- rules rejection surge
- quota exhaustion simulation

## Phase Plan

### Phase 1: Finish Large Local Data Hardening

Build next:

- inventory pagination and virtualization
- team pagination and summary queries
- analytics aggregates for dashboard and reports
- remove remaining full-table UI hydrations

Exit criteria:

- no major list screen loads entire tables by default
- no main screen freezes with large local datasets

### Phase 2: Background Jobs and Summary Layer

Build next:

- import job system
- aggregate writer jobs
- export/report jobs
- payroll summary jobs

Exit criteria:

- large imports and reports no longer run on the main thread
- analytics reads mostly summary-backed

### Phase 3: Security and Operational Readiness

Build next:

- App Check
- rate limiting
- backend-only privileged operations
- observability stack
- alerting
- backup verification

Exit criteria:

- privileged surfaces are auditable and rate-limited
- production issues can be detected quickly

### Phase 4: Platform Scale-Out

Build next:

- multi-region strategy if needed
- queue scaling
- analytics warehouse
- tenant isolation tuning
- cost controls
- load-test certification

Exit criteria:

- proven concurrency targets
- proven import throughput targets
- proven failover behavior

## Recommended Immediate Backlog

This is the order to execute now:

1. Inventory pagination plus virtualization.
2. Team pagination plus payroll summary tables.
3. Analytics aggregate repository plus background writers.
4. Import job model and worker pipeline.
5. Security hardening pass on auth, rules, and privileged writes.
6. Monitoring and load-test harness.

## What "Global Level" Means Here

For this product, "global level" should mean:

- one shop can become very large without freezing the app
- many shops can operate at once without noisy-neighbor failures
- imports and reports run asynchronously and safely
- data growth does not make the client heavier over time
- compromised clients cannot directly perform privileged writes
- operators can see and fix production issues quickly

That is the real path to a platform that feels unlimited to users, even though every system still has engineering limits underneath.
