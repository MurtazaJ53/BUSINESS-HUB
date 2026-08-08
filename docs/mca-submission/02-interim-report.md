# Interim Report — Research Methodology

> Format: JAIN Online Annexure 3 (Presentation or PDF). Rewrite in your own words.
> Deliver as slides *or* a short PDF covering the seven points below.

**Name:** _(your name)_ **USN:** _(your USN)_ **Elective:** CSIT

---

## 1. Objectives of the Study

1. Build an offline-first POS where every transaction is written locally first and synchronised
   reliably via idempotent commands.
2. Model the retail domain correctly: event-sourced fractional stock, customer-credit ledger,
   GST-accurate billing (CGST/SGST/IGST, HSN, GSTR-1/3B), multi-tenant isolation.
3. Verify — with tests and on-device evidence — that the sync design loses and duplicates zero
   transactions across offline/online transitions.

## 2. Scope of the Study

**In scope:** the Flutter mobile client, the Django/PostgreSQL backend, offline-first sync,
GST billing and returns, inventory (event-sourced), customers/khata, reporting, RBAC, and
on-device verification of the sync guarantees.

**Out of scope:** hosted production deployment, completion of the Firebase→JWT auth migration,
multi-language UI, and production-scale load testing (see Limitations).

## 3. Methodology (overview)

Application-based project using an **iterative, backend-first** approach. Each feature vertical
is delivered end-to-end (model → API → local store → UI → tests → device check). The
synchronisation contract is settled first because the client cannot be trusted until it is.

## 4. Research / System Design

- **Client:** Flutter + Riverpod + Drift/SQLite. Local DB is authoritative for the UI; a
  `commerce_outbox` table queues idempotent commands.
- **Backend:** Django 6 + DRF + PostgreSQL. Row-level multi-tenancy (`Shop` / `ShopMembership`);
  event-sourced stock ledger; server-computed projections; Celery/Redis for async work.
- **Sync:** push queued commands with backoff and a dead-letter queue; pull as an upsert-merge
  that never overwrites unsynced local edits.
- **Key artefacts to show:** ER diagram, sync sequence diagram, multi-tenancy diagram,
  component/architecture diagram. (Sources: `docs/data-model-erd.md`, `docs/architecture-overview.md`,
  `docs/04_TECHNICAL_DUE_DILIGENCE.md`.)

## 5. Data Collection Method

- **Primary:** on-device testing against a live backend; automated test suites (232 mobile
  tests, 116 backend test files); recorded sync/verification runs.
- **Secondary:** literature on local-first sync, event sourcing, Indian SME POS digitisation,
  and GST e-invoicing.

## 6. Sampling Method (if applicable)

Not a survey-based study. "Samples" are **test scenarios and transaction sets**: e.g. batches of
offline sales (including fractional/by-weight lines) created offline and reconciled on reconnect;
duplicate-import scenarios; permanently-rejected commands routed to the dead-letter queue.

## 7. Data Analysis Tools

- Automated unit and widget test suites (pass/fail counts and coverage of critical paths).
- Comparison of observed outcomes against objectives: zero lost/duplicated transactions,
  GST-accurate totals, correct running balances.
- Request/response inspection against the running backend; static code analysis.
- Presentation of results as tables and charts in Chapter 4.

---

### Speaker notes for the interim deck (optional)

- Lead with the *problem* (offline + GST) — it justifies every design choice.
- Show the offline→online data-flow diagram; this is the intellectual core.
- End on how you will *measure* success (the objectives, restated as pass/fail criteria).
