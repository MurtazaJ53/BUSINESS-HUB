# All Diagrams

This file embeds every Mermaid diagram extracted from the Business Hub docs pack.

## system context

Source group: `architecture overview`

```mermaid
flowchart LR
  User["Owner / Admin / Staff"] --> Web["Web Admin App\nReact + Vite"]
  User --> Mobile["Flutter Mobile App\nRiverpod + Drift"]

  Web --> WebLocal["Web Local DB\nSQLite via SQL.js / Capacitor SQLite"]
  Mobile --> MobileLocal["Mobile Local DB\nDrift + SQLite"]

  Web --> Auth["Firebase Auth"]
  Mobile --> Auth

  Web --> Firestore["Cloud Firestore"]
  Mobile --> Firestore

  Web --> Functions["Cloud Functions"]
  Mobile --> Functions

  Web --> Storage["Firebase Storage"]
  Mobile --> Storage

  Hosting["Firebase Hosting"] --> Web

  Firestore --> Functions
  Functions --> Firestore
```

## web admin runtime

Source group: `architecture overview`

```mermaid
flowchart TD
  UI["React UI"] --> AuthStore["useAuthStore"]
  UI --> BizStore["useBusinessStore"]
  BizStore --> LocalRepos["Repository layer"]
  LocalRepos --> WebSQLite["Local SQLite schema"]
  BizStore --> Outbox["sync_queue"]
  SyncWorker["SyncWorker"] --> Outbox
  SyncWorker --> Firestore["Cloud Firestore"]
  Firestore --> SyncWorker
  AuthStore --> FirebaseAuth["Firebase Auth"]
```

## flutter mobile runtime

Source group: `architecture overview`

```mermaid
flowchart TD
  MobileUI["Flutter screens"] --> Session["mobileSessionProvider"]
  MobileUI --> Repos["mobile_repository.dart"]
  Repos --> Drift["Drift / SQLite"]
  Session --> Recovery["Workspace recovery"]
  Recovery --> Auth["Firebase Auth"]
  Recovery --> Firestore["Cloud Firestore"]
  Sync["MobileSyncCoordinator"] --> Firestore
  Sync --> Drift
  MobileUI --> Sync
```

## web sync path

Source group: `architecture overview`

```mermaid
sequenceDiagram
  participant UI as Web UI
  participant Local as Web SQLite
  participant Outbox as sync_queue
  participant Sync as SyncWorker
  participant Cloud as Firestore

  UI->>Local: Write entity
  UI->>Outbox: Enqueue mutation
  Sync->>Outbox: Drain pending operations
  Sync->>Cloud: Batch push
  Cloud-->>Sync: Snapshot updates
  Sync->>Local: Merge remote changes
  Local-->>UI: Live local query updates
```

## flutter mobile sync path

Source group: `architecture overview`

```mermaid
sequenceDiagram
  participant User as Signed-in user
  participant Session as mobileSessionProvider
  participant Sync as MobileSyncCoordinator
  participant Cloud as Firestore
  participant Local as Drift SQLite
  participant UI as Flutter UI

  User->>Session: Authenticate
  Session->>Cloud: Recover shop context
  Session-->>Sync: shopId + role
  Sync->>Local: Clear stale workspace cache if shop changed
  Sync->>Cloud: Prime initial workspace snapshot
  Sync->>Local: Seed shop / inventory / sales
  Sync->>Cloud: Attach live listeners
  Cloud-->>Sync: Incremental changes
  Sync->>Local: Merge updates
  Local-->>UI: Stream fresh mobile views
```

## deployment view

Source group: `architecture overview`

```mermaid
flowchart TD
  Repo["GitHub repository"] --> Actions["GitHub Actions"]
  Actions --> Hosting["Firebase Hosting deploy"]
  Actions --> APK["Android APK artifact"]
  Hosting --> WebProd["Live web/admin app"]
  APK --> Testers["Android beta testers"]
```

## final platform architecture

Source group: `business hub complete platform handbook`

```mermaid
flowchart TD
  subgraph Clients["Client Products"]
    Mobile["Flutter Mobile"]
    AdminWeb["Next.js Admin Web"]
    PublicWeb["Next.js Public Web"]
    Desktop["Tauri Desktop Shell"]
  end

  subgraph Edge["Edge and Delivery"]
    CDN["CDN / WAF / Edge Cache"]
    Routing["Regional Routing"]
  end

  subgraph App["Application Platform"]
    API["Django + DRF API"]
    Realtime["Selective Realtime Layer"]
    Queue["Redis / Durable Queue"]
    Workers["Celery Workers"]
  end

  subgraph Data["Core Data Platform"]
    Redis["Redis"]
    Pooler["pgBouncer / Supavisor"]
    Postgres["PostgreSQL"]
    Storage["Object Storage + CDN"]
    Analytics["Analytics / Warehouse later"]
  end

  subgraph Control["Control Plane"]
    OTel["OpenTelemetry + Collector"]
    Ops["Grafana / Sentry / Alerts"]
    IaC["Terraform / Pulumi"]
    Workflow["Temporal when needed"]
    Testing["k6 / Artillery / Chaos"]
  end

  Mobile --> CDN
  AdminWeb --> CDN
  PublicWeb --> CDN
  Desktop --> CDN
  CDN --> Routing
  Routing --> API
  API --> Redis
  API --> Pooler
  Pooler --> Postgres
  API --> Queue
  Queue --> Workers
  API --> Storage
  Workers --> Pooler
  Workers --> Storage
  Workers --> Analytics
  Postgres --> Realtime
  Realtime --> Mobile
  Realtime --> AdminWeb
  Realtime --> Desktop

  Mobile -. telemetry .-> OTel
  AdminWeb -. telemetry .-> OTel
  Desktop -. telemetry .-> OTel
  API -. telemetry .-> OTel
  Workers -. telemetry .-> OTel
  Postgres -. telemetry .-> OTel
  Realtime -. telemetry .-> OTel
  OTel --> Ops
  IaC --> API
  IaC --> Workers
  IaC --> Postgres
  Testing --> API
  Testing --> Workers
  Workflow --> Workers
```

## 1 cloud firestore erd

Source group: `data model erd`

```mermaid
erDiagram
  USERS {
    string userId PK
    string email
    string shopId
    string role
    string updatedAt
  }

  SHOPS {
    string shopId PK
    string ownerId
    string name
    map settings
    string inviteCode
    string createdAt
  }

  STAFF {
    string id PK
    string role
    string status
    string email
    string phone
    map permissions
    number updatedAt
  }

  STAFF_PRIVATE {
    string id PK
    number salary
    string pin
    number updatedAt
  }

  INVENTORY {
    string id PK
    string name
    number price
    string sku
    string category
    string subcategory
    string size
    number stock
    any sourceMeta
    any createdAt
    any updatedAt
    boolean tombstone
  }

  INVENTORY_PRIVATE {
    string id PK
    number costPrice
    string supplierId
    string lastPurchaseDate
    any updatedAt
    boolean tombstone
  }

  SALES {
    string id PK
    number total
    number discount
    string discountType
    string paymentMode
    string customerName
    string customerPhone
    string customerId
    string footerNote
    string date
    any createdAt
    any updatedAt
    string staffId
    boolean tombstone
  }

  CUSTOMERS {
    string id PK
    string name
    string phone
    string email
    number totalSpent
    number balance
    any createdAt
    any updatedAt
    boolean tombstone
  }

  EXPENSES {
    string id PK
    string category
    number amount
    string description
    string paymentMethod
    string paymentReference
    string date
    any createdAt
    any updatedAt
    boolean tombstone
  }

  ATTENDANCE {
    string id PK
    string staffId
    string date
    string clockIn
    string clockOut
    string status
    number totalHours
    number overtime
    number bonus
    string note
    any updatedAt
    boolean tombstone
  }

  INVITATIONS {
    string id PK
    string createdAt
  }

  JOBS {
    string id PK
    string type
    string status
    number createdAt
  }

  IMPORTS {
    string id PK
    string type
    string status
    number createdAt
  }

  BACKUP_ARCHIVES {
    string id PK
    string createdAt
  }

  DASHBOARD_SNAPSHOT {
    string id PK
  }

  AGGREGATES_DAILY {
    string id PK
  }

  CUSTOMER_CREDIT_SUMMARY {
    string id PK
  }

  STAFF_PAYROLL_SUMMARY {
    string id PK
  }

  USERS ||--o{ SHOPS : "owner via ownerId"
  SHOPS ||--o{ STAFF : contains
  SHOPS ||--o{ STAFF_PRIVATE : contains
  SHOPS ||--o{ INVENTORY : contains
  SHOPS ||--o{ INVENTORY_PRIVATE : contains
  SHOPS ||--o{ SALES : contains
  SHOPS ||--o{ CUSTOMERS : contains
  SHOPS ||--o{ EXPENSES : contains
  SHOPS ||--o{ ATTENDANCE : contains
  SHOPS ||--o{ INVITATIONS : contains
  SHOPS ||--o{ JOBS : contains
  SHOPS ||--o{ IMPORTS : contains
  SHOPS ||--o{ BACKUP_ARCHIVES : contains
  SHOPS ||--o{ DASHBOARD_SNAPSHOT : contains
  SHOPS ||--o{ AGGREGATES_DAILY : contains
  SHOPS ||--o{ CUSTOMER_CREDIT_SUMMARY : contains
  SHOPS ||--o{ STAFF_PAYROLL_SUMMARY : contains
```

## 2 legacy web admin local sqlite erd

Source group: `data model erd`

```mermaid
erDiagram
  INVENTORY {
    string id PK
    string name
    number price
    string sku
    string category
    string subcategory
    string size
    string description
    number stock
    string sourceMeta
    number createdAt
    number updatedAt
    number tombstone
    number dirty
  }

  INVENTORY_PRIVATE {
    string id PK
    number costPrice
    string supplierId
    string lastPurchaseDate
    number updatedAt
    number dirty
  }

  SALES {
    string id PK
    number total
    number discount
    string discountValue
    string discountType
    string paymentMode
    string customerName
    string customerPhone
    string customerId
    string footerNote
    string sourceMeta
    string date
    number createdAt
    number updatedAt
    number tombstone
    number dirty
  }

  SALE_ITEMS {
    string id PK
    string saleId FK
    string itemId
    string name
    number quantity
    number price
    number costPrice
    string size
    number isReturn
  }

  SALE_PAYMENTS {
    string id PK
    string saleId FK
    string mode
    number amount
  }

  CUSTOMERS {
    string id PK
    string name
    string phone
    string email
    number totalSpent
    number balance
    string sourceMeta
    number createdAt
    number updatedAt
    number tombstone
    number dirty
  }

  CUSTOMER_PAYMENTS {
    string id PK
    string customerId FK
    number amount
    string date
    number createdAt
    number updatedAt
    number tombstone
    number dirty
  }

  EXPENSES {
    string id PK
    string category
    number amount
    string description
    string paymentMethod
    string paymentReference
    string date
    number createdAt
    number updatedAt
    number tombstone
    number dirty
  }

  STAFF {
    string id PK
    string name
    string phone
    string email
    string role
    string joinedAt
    string status
    string permissions
    number updatedAt
    number tombstone
    number dirty
  }

  STAFF_PRIVATE {
    string id PK
    number salary
    string pin
    number updatedAt
    number dirty
  }

  ATTENDANCE {
    string id PK
    string staffId FK
    string date
    string clockIn
    string clockOut
    string status
    number totalHours
    number overtime
    number bonus
    string note
    number updatedAt
    number tombstone
    number dirty
  }

  SHOP_METADATA {
    string key PK
    string value
    number updatedAt
    number dirty
  }

  LOCAL_BACKUPS {
    string id PK
    string label
    string trigger
    number createdAt
    number sizeBytes
    string payload
  }

  SYNC_QUEUE {
    string opId PK
    string entityType
    string entityId
    string operation
    string payload
    number createdAt
    number retries
  }

  SYNC_STATE {
    string entityType PK
    number lastSyncedAt
  }

  SALES ||--o{ SALE_ITEMS : has
  SALES ||--o{ SALE_PAYMENTS : has
  CUSTOMERS ||--o{ CUSTOMER_PAYMENTS : has
  STAFF ||--o{ ATTENDANCE : has
  INVENTORY ||--|| INVENTORY_PRIVATE : "cost extension"
  STAFF ||--|| STAFF_PRIVATE : "private extension"
```

## 3 flutter mobile local sqlite erd

Source group: `data model erd`

```mermaid
erDiagram
  SHOP_SETTINGS {
    string key PK
    string value
    number updatedAt
  }

  INVENTORY {
    string id PK
    string name
    number price
    string sku
    string category
    string subcategory
    string size
    string description
    number stock
    string sourceMeta
    number createdAt
    number updatedAt
    boolean tombstone
  }

  INVENTORY_PRIVATE {
    string id PK
    number costPrice
    string supplierId
    string lastPurchaseDate
    number updatedAt
    boolean tombstone
  }

  SALES {
    string id PK
    number total
    number discount
    string discountType
    string paymentMode
    string date
    number createdAt
    number updatedAt
    string customerName
    string customerPhone
    string customerId
    string footerNote
    string itemsJson
    string paymentsJson
    boolean tombstone
  }

  INVENTORY ||--|| INVENTORY_PRIVATE : "cost extension"
```

## final architecture in one view

Source group: `final architecture blueprint`

```mermaid
flowchart TD
  subgraph Clients["Client Products"]
    Mobile["Flutter Mobile"]
    AdminWeb["Next.js Admin Web"]
    PublicWeb["Next.js Public Web"]
    Desktop["Tauri Desktop Shell"]
  end

  subgraph Edge["Edge and Delivery"]
    CDN["CDN / Edge Cache / WAF"]
    Routing["Regional Routing"]
  end

  subgraph App["Core Application Platform"]
    API["Stateless Backend API\nNestJS modular monolith first"]
    Realtime["Selective Realtime Gateway"]
    Workers["Background Workers"]
    Queue["Durable Queue"]
  end

  subgraph Data["Core Data Platform"]
    Redis["Redis"]
    Postgres["PostgreSQL"]
    Pooler["Supavisor / PgBouncer"]
    Storage["Object Storage + CDN"]
    Analytics["Analytics / Warehouse later"]
  end

  subgraph Control["Control Plane"]
    OTel["OpenTelemetry + Collector"]
    Ops["Grafana / Sentry / Alerts"]
    IaC["Terraform / Pulumi"]
    Workflow["Temporal when needed"]
    Testing["k6 / Artillery / Chaos"]
  end

  Mobile --> CDN
  AdminWeb --> CDN
  PublicWeb --> CDN
  Desktop --> CDN

  CDN --> Routing
  Routing --> API
  API --> Redis
  API --> Pooler
  Pooler --> Postgres
  API --> Queue
  Queue --> Workers
  Workers --> Pooler
  API --> Storage
  Workers --> Storage
  Workers --> Analytics
  Postgres --> Realtime
  Realtime --> Mobile
  Realtime --> AdminWeb
  Realtime --> Desktop

  Mobile -. telemetry .-> OTel
  AdminWeb -. telemetry .-> OTel
  Desktop -. telemetry .-> OTel
  API -. telemetry .-> OTel
  Workers -. telemetry .-> OTel
  Postgres -. telemetry .-> OTel
  Realtime -. telemetry .-> OTel
  OTel --> Ops
  IaC --> API
  IaC --> Workers
  IaC --> Postgres
  Testing --> API
  Testing --> Workers
  Workflow --> Workers
```

## migration model

Source group: `firebase to postgres migration plan`

```mermaid
flowchart LR
  OldClients["Legacy Clients\nFirebase writers"]
  NewClients["New Clients\nPostgres/API writers"]
  Firebase["Firebase"]
  Bridge["Migration Bridge"]
  Postgres["PostgreSQL"]
  Verify["Shadow Verification"]

  OldClients --> Firebase
  Firebase --> Bridge
  Bridge --> Postgres
  Postgres --> Verify
  Firebase --> Verify
  NewClients --> Postgres
```

## core relational model

Source group: `firebase to postgres schema map`

```mermaid
erDiagram
  USERS ||--o{ SHOP_MEMBERSHIPS : belongs_to
  SHOPS ||--o{ SHOP_MEMBERSHIPS : has
  SHOP_MEMBERSHIPS ||--o| MEMBERSHIP_PRIVATE : has

  SHOPS ||--o{ INVENTORY_ITEMS : owns
  INVENTORY_ITEMS ||--o| INVENTORY_ITEM_PRIVATE : has
  INVENTORY_ITEMS ||--o{ INVENTORY_STOCK_LEDGER : produces

  SHOPS ||--o{ CUSTOMERS : owns
  CUSTOMERS ||--o{ CUSTOMER_LEDGER_ENTRIES : produces
  CUSTOMERS ||--o{ CUSTOMER_PAYMENTS : receives

  SHOPS ||--o{ SALES : owns
  SALES ||--o{ SALE_ITEMS : contains
  SALES ||--o{ SALE_PAYMENTS : contains
  SALES }o--|| CUSTOMERS : references
  SALES }o--|| SHOP_MEMBERSHIPS : performed_by

  SHOPS ||--o{ EXPENSES : owns
  SHOPS ||--o{ ATTENDANCE_SESSIONS : owns

  SHOPS ||--o{ JOBS : owns
  JOBS ||--o{ JOB_EVENTS : emits
  SHOPS ||--o{ IMPORTS : owns
  IMPORTS ||--o{ IMPORT_ERRORS : emits

  SHOPS ||--o{ AUDIT_EVENTS : owns
  SHOPS ||--o{ DASHBOARD_SNAPSHOT_CURRENT : has
  SHOPS ||--o{ SHOP_DAILY_METRICS : has
```

## recommended global target architecture

Source group: `high scale global architecture`

```mermaid
flowchart TD
  subgraph Users["Global Users"]
    Mobile["Flutter Mobile"]
    Admin["Admin Web"]
    Public["Public Web"]
    Desktop["Tauri Desktop"]
  end

  subgraph Edge["Edge Layer"]
    CDN["Cloudflare / Global CDN"]
    WAF["WAF + Bot Protection"]
    EdgeAuth["Edge Validation\nToken, Rate Limit, Geo Rules"]
  end

  subgraph App["Application Plane"]
    Gateway["API Gateway / Load Balancer"]
    API["Stateless Backend API\nNestJS Modular Monolith"]
    Realtime["Realtime Gateway\nSupabase Realtime / WebSockets / SSE"]
  end

  subgraph Compute["Async Compute Plane"]
    Queue["Kafka / SQS / Durable Queue"]
    Workers["Workers / Job Processors"]
    Scheduler["Cron / Scheduled Jobs"]
  end

  subgraph Data["Data Plane"]
    Redis["Redis Cluster"]
    Pooler["Supavisor / PgBouncer"]
    Primary["PostgreSQL Primary"]
    Replicas["Global Read Replicas"]
    Storage["Object Storage + CDN"]
    Warehouse["Analytics Store\nBigQuery / ClickHouse later"]
  end

  Mobile --> CDN
  Admin --> CDN
  Public --> CDN
  Desktop --> CDN

  CDN --> WAF
  WAF --> EdgeAuth
  EdgeAuth --> Gateway

  Gateway --> API
  API --> Redis
  API --> Pooler
  Pooler --> Primary
  Primary --> Replicas
  API --> Storage
  API --> Queue

  Queue --> Workers
  Scheduler --> Workers
  Workers --> Pooler
  Workers --> Redis
  Workers --> Storage
  Workers --> Warehouse
  Primary --> Realtime
  Realtime --> Mobile
  Realtime --> Admin
  Realtime --> Desktop
```

## best in class request flow

Source group: `high scale global architecture`

```mermaid
sequenceDiagram
  participant User as User
  participant Edge as CDN / Edge
  participant API as Backend API
  participant Cache as Redis
  participant DB as PostgreSQL
  participant Queue as Queue
  participant Worker as Worker
  participant RT as Realtime

  User->>Edge: Request screen / action
  Edge-->>User: Static assets if cacheable
  Edge->>API: Forward dynamic request
  API->>Cache: Check hot cache
  alt Cache hit
    Cache-->>API: Cached payload
    API-->>User: Fast response
  else Cache miss
    API->>DB: Query primary or replica
    DB-->>API: Data
    API->>Cache: Fill cache
    API-->>User: Response
  end

  User->>API: Write action
  API->>DB: Transactional write
  API->>Queue: Enqueue heavy follow-up
  API-->>User: Immediate success
  DB->>RT: Change event
  RT-->>User: Confirmation / update
  Queue->>Worker: Process async job
  Worker->>DB: Summary / export / side effects
```

## owner sign in

Source group: `platform scenarios and operational flows`

```mermaid
sequenceDiagram
  participant User as Owner
  participant Auth as Auth Provider
  participant API as Backend API
  participant PG as PostgreSQL
  participant Bridge as Bridge

  User->>Auth: Sign in
  Auth-->>API: Identity token
  API->>PG: Resolve user + shop membership
  alt Membership exists in PostgreSQL
    PG-->>API: Membership found
    API-->>User: Session ready
  else Membership missing during migration
    API->>Bridge: Recover from Firebase-era membership data
    Bridge->>PG: Materialize membership
    PG-->>API: Membership ready
    API-->>User: Session ready
  end
```

## offline sale reconnect

Source group: `platform scenarios and operational flows`

```mermaid
sequenceDiagram
  participant Mobile as Offline Mobile
  participant API as Backend API
  participant Rules as Validation Layer
  participant PG as PostgreSQL
  participant Queue as Reconciliation Queue

  Mobile->>API: Replay sale command with client_tx_id, base_version, domain_epoch
  API->>Rules: Validate command
  alt Valid and policy-allowed
    Rules->>PG: Commit sale + sale_items + sale_payments + stock ledger
    PG-->>API: Commit success
    API-->>Mobile: Accepted
  else Ambiguous or invalid
    Rules->>Queue: Create reconciliation event
    API-->>Mobile: Pending review / rejected with reason
  end
```

## reconciliation review

Source group: `platform scenarios and operational flows`

```mermaid
sequenceDiagram
  participant System as Validation System
  participant Queue as migration_reconciliation_events
  participant Admin as Review Dashboard
  participant PG as PostgreSQL

  System->>Queue: Insert review item
  Admin->>Queue: Open pending item
  Admin->>PG: Approve or reject resolution action
  PG-->>Queue: Mark resolved
```

## what this control plane protects

Source group: `production control plane architecture`

```mermaid
flowchart LR
  Client["Flutter / Web / Desktop"]
  Edge["Edge Routing"]
  API["Ingestion / Business APIs"]
  Stream["Kafka / PubSub"]
  Workers["Validation + Commit Workers"]
  Ledger["Spanner / CockroachDB"]
  Fanout["Realtime Fanout"]

  Control["Production Control Plane"]

  Client --> Edge --> API --> Stream --> Workers --> Ledger --> Fanout --> Client

  Control -. Traces / Metrics / Logs .-> Client
  Control -. Traces / Metrics / Logs .-> Edge
  Control -. Traces / Metrics / Logs .-> API
  Control -. Traces / Metrics / Logs .-> Stream
  Control -. Traces / Metrics / Logs .-> Workers
  Control -. Traces / Metrics / Logs .-> Ledger
  Control -. Traces / Metrics / Logs .-> Fanout
```

## required trace path

Source group: `production control plane architecture`

```mermaid
sequenceDiagram
  participant Client as Client
  participant Edge as Edge
  participant API as API
  participant Stream as Queue
  participant Worker as Worker
  participant DB as Ledger DB
  participant RT as Realtime
  participant Obs as OTel Collector / Backend

  Client->>Edge: Request with trace context
  Edge->>API: Forward context
  API->>Stream: Publish event + metadata
  Stream->>Worker: Deliver event
  Worker->>DB: Commit transaction
  DB->>RT: Change event
  RT-->>Client: Notify completion

  Client-->>Obs: client perf data
  Edge-->>Obs: spans / metrics
  API-->>Obs: spans / metrics / logs
  Worker-->>Obs: spans / metrics / logs
  DB-->>Obs: db metrics
  RT-->>Obs: fanout metrics
```

## example workflow stages

Source group: `production control plane architecture`

```mermaid
stateDiagram-v2
  [*] --> Accepted
  Accepted --> SchemaValidated
  SchemaValidated --> AuthValidated
  AuthValidated --> IdempotencyChecked
  IdempotencyChecked --> BusinessRuleValidated
  BusinessRuleValidated --> StockValidated
  StockValidated --> LedgerCommitted
  LedgerCommitted --> ProjectionsUpdated
  ProjectionsUpdated --> FanoutDelivered
  FanoutDelivered --> [*]

  SchemaValidated --> Rejected
  AuthValidated --> Rejected
  IdempotencyChecked --> Rejected
  BusinessRuleValidated --> Rejected
  StockValidated --> Rejected
  Rejected --> [*]
```

## 10 recommended deployment control architecture

Source group: `production control plane architecture`

```mermaid
flowchart TD
  subgraph Runtime["Runtime System"]
    Clients["Clients"]
    Edge["Edge + WAF"]
    APIs["APIs"]
    Stream["Queue / Stream"]
    Workflows["Temporal Workflows"]
    Workers["Workers"]
    DB["Ledger DB"]
    Fanout["Realtime"]
  end

  subgraph Control["Control Plane"]
    OTel["OpenTelemetry + Collector"]
    Dash["Grafana / Sentry / Alerting"]
    IaC["Terraform / Pulumi"]
    CI["CI/CD + Policy Gates"]
    Test["k6 / Artillery / Chaos Tests"]
    Sec["Secrets + Identity"]
  end

  Clients --> Edge --> APIs --> Stream --> Workflows --> Workers --> DB --> Fanout

  Clients -. telemetry .-> OTel
  Edge -. telemetry .-> OTel
  APIs -. telemetry .-> OTel
  Stream -. telemetry .-> OTel
  Workflows -. telemetry .-> OTel
  Workers -. telemetry .-> OTel
  DB -. telemetry .-> OTel
  Fanout -. telemetry .-> OTel

  OTel --> Dash
  IaC --> CI
  CI --> Runtime
  Test --> Runtime
  Sec --> Runtime
```

## target system map

Source group: `target platform architecture`

```mermaid
flowchart LR
  subgraph Clients["Client Layer"]
    Mobile["Flutter Mobile App"]
    AdminWeb["Next.js Admin Web"]
    PublicWeb["Next.js Public Web"]
    Desktop["Tauri 2 Desktop Shell"]
  end

  subgraph Edge["Edge and Delivery"]
    CDN["CDN / Edge Cache"]
    LB["Load Balancer / API Gateway"]
  end

  subgraph App["Application Layer"]
    API["Stateless Backend API\nNestJS or Fastify"]
    Realtime["Realtime Gateway\nSupabase Realtime / WS / SSE"]
    Workers["Background Workers"]
  end

  subgraph Data["Data Layer"]
    Redis["Redis Cache"]
    Postgres["PostgreSQL"]
    Pooler["Connection Pooler\nSupavisor / PgBouncer"]
    Storage["Object Storage + CDN"]
  end

  Mobile --> CDN
  AdminWeb --> CDN
  PublicWeb --> CDN
  Desktop --> CDN

  Mobile --> LB
  AdminWeb --> LB
  PublicWeb --> LB
  Desktop --> LB

  LB --> API
  API --> Redis
  API --> Pooler
  Pooler --> Postgres
  API --> Storage
  API --> Workers
  Workers --> Pooler
  Workers --> Redis
  Workers --> Storage
  Postgres --> Realtime
  Realtime --> Mobile
  Realtime --> AdminWeb
  Realtime --> Desktop
```

## mobile data flow

Source group: `target platform architecture`

```mermaid
sequenceDiagram
  participant UI as Flutter UI
  participant Local as SQLite / Drift
  participant Outbox as Local Outbox
  participant API as Backend API
  participant Jobs as Workers
  participant DB as PostgreSQL
  participant RT as Realtime

  UI->>Local: Write immediately
  UI->>Outbox: Queue mutation
  Local-->>UI: Update screen instantly
  Outbox->>API: Sync mutation
  API->>DB: Transactional write
  API-->>Outbox: Ack / version
  DB->>RT: Change event
  RT-->>UI: Confirmation / refresh signal
  API->>Jobs: Heavy work if needed
  Jobs->>DB: Background updates
  DB->>RT: Job completion events
```

## core idea

Source group: `ultra high write transaction architecture`

```mermaid
flowchart LR
  Client["Flutter / Web / Desktop Client"]
  Edge["Global Edge / Regional Routing"]
  Ingest["Ultra-fast Ingestion API"]
  Stream["Durable Event Stream\nKafka or Pub/Sub"]
  Validate["Validation Workers"]
  Ledger["Distributed SQL Ledger\nSpanner or CockroachDB"]
  Fanout["Realtime Fanout Layer"]
  ReadModel["Read Models / Cache / Projections"]

  Client --> Edge
  Edge --> Ingest
  Ingest --> Stream
  Stream --> Validate
  Validate --> Ledger
  Ledger --> Fanout
  Ledger --> ReadModel
  Fanout --> Client
  ReadModel --> Client
```

## global target architecture

Source group: `ultra high write transaction architecture`

```mermaid
flowchart TD
  subgraph Clients["Client Layer"]
    Mobile["Flutter Mobile"]
    Web["Next.js Admin / Public Web"]
    Desktop["Tauri Desktop"]
  end

  subgraph Edge["Global Edge Plane"]
    CDN["Cloudflare / Global CDN"]
    WAF["WAF + Bot Protection"]
    Router["Regional Routing + Rate Limiting"]
    EdgeAuth["Edge Token Screening"]
  end

  subgraph Ingestion["Write Ingestion Plane"]
    IngestAPI["Go or Rust Ingestion API"]
    Idempotency["Idempotency / Replay Guard"]
    OutboxAck["Fast Ack Service"]
  end

  subgraph Stream["Streaming Plane"]
    Topic["Kafka / Pub/Sub Transaction Topics"]
    DLQ["Dead Letter / Retry Topics"]
  end

  subgraph Validation["Validation and Commit Plane"]
    Validator["Validation Workers"]
    RuleEngine["Business Rules / Risk / Limits"]
    Committer["Ledger Commit Workers"]
  end

  subgraph Data["Core Data Plane"]
    Ledger["Distributed SQL Ledger\nSpanner or CockroachDB"]
    Redis["Redis / Cache / Fanout Assist"]
    Storage["Object Storage"]
    Analytics["Warehouse / OLAP"]
  end

  subgraph Realtime["Realtime Plane"]
    Notify["Realtime Fanout / WS / SSE"]
  end

  Mobile --> CDN
  Web --> CDN
  Desktop --> CDN

  CDN --> WAF
  WAF --> Router
  Router --> EdgeAuth
  EdgeAuth --> IngestAPI

  IngestAPI --> Idempotency
  Idempotency --> Topic
  IngestAPI --> OutboxAck
  OutboxAck --> Mobile
  OutboxAck --> Web
  OutboxAck --> Desktop

  Topic --> Validator
  Validator --> RuleEngine
  RuleEngine --> Committer
  Committer --> Ledger
  Validator --> DLQ

  Ledger --> Redis
  Ledger --> Analytics
  Ledger --> Notify
  Notify --> Mobile
  Notify --> Web
  Notify --> Desktop
```

