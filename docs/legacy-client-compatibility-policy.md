# Business Hub Legacy Client Compatibility Policy

## Purpose

This document defines how legacy Firebase-first clients are allowed to behave while Business Hub is moving through pilot cutovers and domain-by-domain migration.

It exists to prevent one of the most dangerous migration failures:

- stale client versions continuing to write authoritative state after domain ownership has moved
- silent overwrite of PostgreSQL truth by offline or outdated clients
- support teams guessing whether an old app version is still allowed to operate

## Scope

This policy applies to:

- the legacy web/admin path when it still depends on Firebase-first domain logic
- old mobile clients that still read or write Firebase-backed data
- offline mobile sessions reconnecting after domain ownership changes

It applies specifically during:

- Phase 2 migration backbone
- Phase 3 pilot cutovers
- Phase 4 commerce cutovers

## Core rules

### 1. One write owner per domain

At any moment, a domain has exactly one write master:

- `firebase`
- `postgres`

Legacy clients must never write directly to a domain once that domain has moved to PostgreSQL ownership.

### 2. Legacy clients may degrade to read-only

A legacy client can remain usable for a domain in one of these postures:

- full write access while Firebase is still authoritative
- read-only shadow access while PostgreSQL is authoritative
- blocked access when safe fallback is not possible

### 3. Offline replay is command-based, not overwrite-based

When a legacy or mobile client reconnects after being offline:

- mutable reference data must not overwrite server truth
- append-only facts must be replayed as commands
- server version, domain epoch, and invariants decide whether the replay is accepted, rejected, or routed to review

### 4. Client clocks are not truth

Client timestamps are never authoritative for conflict resolution.

Server truth uses:

- domain epoch
- current write owner
- idempotency key / client transaction id
- server-side business invariants

## Supported compatibility modes

### Mode A: Fully supported

Allowed only when:

- domain write owner is still `firebase`
- bridge posture does not require PostgreSQL truth
- no forced-upgrade flag exists

Behavior:

- reads allowed
- writes allowed
- offline replay allowed

### Mode B: Shadow read-only

Allowed when:

- domain write owner is `postgres`
- legacy client still needs temporary visibility
- the domain can safely be exposed without write access

Behavior:

- reads allowed
- writes rejected
- operator sees a clear message that the domain has moved

Recommended examples:

- inventory catalog preview
- customer lookup visibility

### Mode C: Restricted / blocked

Used when:

- domain has moved to `postgres`
- safe read-only fallback is not enough
- stale writes would threaten financial or inventory integrity

Behavior:

- writes blocked
- reads may also be blocked if data correctness depends on new projections or workflows
- operator is told to upgrade

Recommended examples:

- sales
- payments
- stock ledger

## Domain guidance

### Shop settings

- legacy writes allowed only while Firebase is the write owner
- after cutover, old clients may read shadow state only if it does not affect secure configuration

### Inventory

- after pilot cutover, legacy clients may read but must not write
- stale inventory writes must be rejected with rehydrate guidance

### Customers

- after pilot cutover, legacy clients may read but must not mutate master customer profile state
- customer ledger-like facts must move through server validation

### Expenses and attendance

- legacy access may remain temporary longer than inventory/customers
- once PostgreSQL owns the domain, direct legacy writes are disabled

### Sales, payments, stock ledger

- legacy clients are never trusted to overwrite these domains once cutover begins
- replay is command-only and must remain auditable

## Forced-upgrade triggers

A legacy client should be forced to upgrade when any of the following are true:

- domain epoch mismatch makes local state stale
- the client attempts writes to a PostgreSQL-primary domain
- the domain has no safe shadow-read fallback
- the client version is below the last supported migration-safe version
- security, auth, or policy changes invalidate the old session model

## Expected operator UX

When a legacy action is rejected, the user must not see a silent failure.

The app should show one of these patterns:

- “This domain has moved to the new system. Refresh before editing.”
- “Your local data is outdated. Rehydrate the latest inventory before retrying.”
- “This version is no longer allowed to write customer updates. Please upgrade.”

## Offline authentication grace period

To avoid locking a cashier out during a real outage:

- an already-authenticated POS session may continue offline within the approved grace period
- current recommendation: `12 hours`

This grace period does **not** mean stale writes are automatically accepted.
It only allows the operator session to keep functioning locally while sync rules still enforce ownership and replay safety.

## Phase 3 policy for pilot domains

For the first pilot domains:

- `inventory`
- `customers`

the compatibility rule is:

- if write owner is `firebase`: legacy writes allowed
- if write owner is `postgres`: legacy writes blocked, shadow reads allowed where safe
- stale reconnect writes must become reconciliation events, not silent updates

## Operational checklist

Before approving a pilot shop:

- verify the domain state surface reports the correct write owner
- verify legacy write rejection returns clear UI messaging
- verify reconciliation captures stale client attempts
- verify rollback can restore the legacy write owner without data loss

## Final policy verdict

Legacy compatibility exists to protect business continuity during migration.

It must never become a permanent excuse to keep dual ownership alive forever.

Business Hub should:

- keep old clients usable only where it is safe
- cut off writes aggressively once a domain has moved
- prefer explicit upgrade pressure over silent corruption
