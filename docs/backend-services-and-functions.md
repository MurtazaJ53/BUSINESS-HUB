# Business Hub Backend Services and Functions

## Backend stack

Business Hub currently depends on Firebase as the main backend platform.

Services in active use:
- Firebase Auth
- Cloud Firestore
- Cloud Functions
- Firebase Storage
- Firebase Hosting
- App Check for web

## Firebase Auth

Purpose:
- identify users
- attach roles and shop context
- support secure session boot

Important behavior:
- claims may lag
- both web and Flutter mobile include recovery paths for missing shop context

## Cloud Firestore

Purpose:
- shared operational cloud data
- cross-device sync backbone
- permission-enforced access

Main data domains:
- shops
- users
- inventory
- inventory_private
- sales
- customers
- expenses
- staff
- attendance
- jobs/imports/invitations
- summary and aggregate collections

## Cloud Functions

Primary entry:
- `functions/src/index.ts`

Global defaults:
- region: `us-central1`
- `maxInstances: 20`
- `cpu: 1`
- `memory: 512MiB`

### Function groups

#### Identity and claims

- `onStaffWrite`
- `migratePermissions`
- `runPermissionsMigration`

Purpose:
- staff claim propagation
- permission migration
- role alignment

#### Aggregation and summaries

- `onSaleWrite`
- `onAttendanceWriteSummary`
- `onCustomerPaymentWriteSummary`
- `onCustomerWriteSummary`
- `onExpenseWriteSummary`

Purpose:
- maintain operational summaries
- reduce expensive client-side recalculation

#### Jobs and operations

- `onBackgroundJobWrite`
- `emitOperationsHeartbeat`

Purpose:
- background import/job lifecycle
- operational observability

#### Analytics and velocity

- `computeVelocity`

Purpose:
- heavier business computation outside the UI path

#### Messaging and AI

- `onAlertCreated`
- `agentTool`
- `runAgent`

Purpose:
- notifications / alert reactions
- AI or agent-powered workflows

#### Security

- `redeemAdminPin`
- `setAdminPin`
- `adminSequesterData`

Purpose:
- privileged admin controls
- secure identity-sensitive actions

## Hosting

Firebase Hosting serves:
- web build output from `dist/`
- strong caching for hashed static assets
- explicit no-cache handling for wasm files and service worker cleanup

## Storage

Storage is present for file and asset handling.

In product terms it is most relevant for:
- imported assets/files
- backup-related artifacts
- future document/media flows

## Rules layer

Primary file:
- `firestore.rules`

Rules enforce:
- shop membership
- admin checks
- granular permission checks
- protected cost/private reads
- protected admin-only collections

## Mobile/backend interaction today

### Web/admin app

Uses:
- Firestore directly
- Cloud Functions
- local outbox + live snapshots

### Flutter mobile app

Uses:
- Firebase Auth
- Firestore bootstrap + listeners
- local Drift cache

Currently Flutter does not yet mirror every backend collection into local mobile storage.

## Backend risks to watch

1. Claims lag versus membership truth
2. Permission mismatch between UI assumptions and Firestore rules
3. Partial sync coverage on Flutter
4. Large collection reads if bootstrap scope grows without paging strategy

## Recommendations

1. Keep Firestore as shared operational truth
2. Expand Flutter local sync gradually, not all at once
3. Keep heavy computation in functions, not in mobile UI
4. Add clearer mobile sync observability before full cutover
