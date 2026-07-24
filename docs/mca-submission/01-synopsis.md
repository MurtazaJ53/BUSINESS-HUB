# Project Synopsis

> Format: JAIN Online Annexure 2. Rewrite prose in your own words before submitting.

**Name:** _(your name)_ **USN:** _(your USN)_
**Elective:** CSIT — Computer Science & IT (Application-based)
**Date of Submission:** _(date)_

---

## Title

**Business Hub — An Offline-First, Multi-Tenant Point-of-Sale and Business-Management
Platform for Indian Retail, with GST Compliance and Cloud Synchronisation.**

---

## Problem Statement (≤ 200 words)

Small and medium retailers in India operate under two hard constraints that most
point-of-sale (POS) software ignores: unreliable internet connectivity and mandatory GST
compliance. Cloud-first billing apps treat the network as the source of truth, so a dropped
signal stalls the counter and risks lost sales. Full ERP suites solve compliance but are too
heavy and expensive for a single-owner shop. Between them lies an unmet need: a tool that is
**fully usable offline**, **safely synchronised** when connectivity returns, and fluent in the
vocabulary of Indian retail — GST slabs (CGST/SGST/IGST), HSN codes, UPI payment, by-weight
selling, and running customer credit (*khata*). The technical difficulty is guaranteeing that
transactions created offline are neither lost nor duplicated when devices reconnect, while
keeping each shop's data isolated on a shared backend. This project addresses that gap by
designing and building an offline-first, event-sourced, multi-tenant retail platform and
verifying its synchronisation guarantees on real hardware.

---

## Objectives of the Project (3 objectives)

1. **Design and implement an offline-first POS** in which every sale, payment, and stock
   change is written to a local database first and queued as an idempotent command for reliable
   synchronisation to a central backend, so counter operations never block on the network.

2. **Model the retail domain correctly** through event-sourced, fractional-safe stock (an
   auditable ledger of quantity deltas), a customer-credit ledger, GST-accurate billing with
   HSN codes and GSTR-1/GSTR-3B exports, and row-level multi-tenant isolation.

3. **Contribute a verifiable reference design** for local-first line-of-business applications by
   demonstrating, with automated tests and on-device evidence, that an idempotent outbox plus
   upsert-merge synchronisation loses and duplicates zero transactions across offline/online
   transitions — the learner's contribution to the field.

---

## Project Methodology (≤ 500 words)

**Type of project:** Application-based (design, build, and empirical verification of a working
software product).

**Overview.** The system is built as a Flutter mobile client backed by a Django REST Framework
service over PostgreSQL. The mobile app is the primary surface and holds a complete local
SQLite database; the backend is the source of truth for cross-device state, GST computation,
and reporting. The two are reconciled by a synchronisation coordinator that pushes queued,
idempotent commands and pulls a merged view of catalogue, customers, and ledgers.

**Development approach.** An iterative, backend-first methodology was used. Each feature vertical
(POS, inventory, customers/khata, GST, reporting) was taken end-to-end: domain model → backend
API with tenant guards and idempotency → local schema and repositories → UI → tests →
on-device verification. This suits an offline-first system because the synchronisation contract
must be settled before the client can be trusted, and it allows continuous verification rather
than a single big-bang integration.

**Key design decisions.** (a) *Offline-first, not cache-then-sync* — the local database is
authoritative for the UI, and a `commerce_outbox` queues commands so the counter is instant
offline. (b) *Event-sourced stock* — quantity is the sum of ledger deltas, making it auditable
and correct for by-weight goods. (c) *Idempotent commands* — each carries a unique key so
retries never double-post. (d) *Upsert-merge pull* — synchronisation never overwrites unsynced
local edits, preventing data loss. (e) *Row-level multi-tenancy* — a `Shop` is the tenant and a
`ShopMembership` carries the user's role; every query is filtered by membership.

**Data collection.**
- *Primary:* on-device testing on a physical Android device against a live backend; automated
  test suites (232 mobile tests, 116 backend test files); synchronisation and verification runs
  recording success/failure of the offline→online transition.
- *Secondary:* domain literature on local-first/offline-first synchronisation, event sourcing,
  POS and SME digitisation in India, and GST e-invoicing (see Chapter 2).

**Analysis tools.** Automated unit/widget test suites; request and response inspection against
the running backend; comparison of observed outcomes (no lost or duplicated transactions,
GST-accurate totals) against the stated objectives; static analysis of the codebase.

**Tools & technologies.** Flutter/Dart, Riverpod, Drift/SQLite (mobile); Django 6, DRF,
PostgreSQL, Celery, Redis (backend); Docker for deployment; Git for version control.

---

## Limitation (≤ 200 words)

This project delivers and verifies the offline-first architecture and the retail domain model,
but scopes out several areas. **Hosted deployment** is not included: synchronisation is
exercised against a local/USB-tunnelled backend rather than a public server, so true
multi-device sync across networks is demonstrated in a controlled configuration rather than in
production. The **authentication migration** from the legacy Firebase provider to the
self-contained JWT flow is partially complete and not the focus of study. The UI is
**single-language (English)**; multi-language support is future scope. Advanced analytics
(demand forecasting, automated reorder points) and external ERP interoperability are designed
for but not evaluated here. Finally, the empirical evaluation uses the developer's own device
and seeded demo data rather than a live multi-shop deployment, so scalability claims rest on
architectural reasoning (PostgreSQL + connection pooling + async workers) rather than a
production load test.

---

## Work Plan (Week 1–8)

| Week | Planned activities |
|------|--------------------|
| **1** | Literature review; problem definition; requirements gathering; domain modelling. |
| **2** | Finalise title and synopsis; backend data model (multi-tenant, event-sourced stock). |
| **3** | Backend command APIs (sale/payment) with idempotency; tenant guards; unit tests. |
| **4** | Mobile local database (SQLite), repositories, and the outbox queue. |
| **5** | Sync coordinator (push + upsert-merge pull, backoff, dead-letter); POS + inventory verticals. |
| **6** | Customers/khata, GST billing (CGST/SGST/IGST, HSN), GSTR-1/3B export, reports. |
| **7** | On-device verification; testing; hardening; signed build; data analysis of results. |
| **8** | Final report writing, formatting, plagiarism check, and submission. |
