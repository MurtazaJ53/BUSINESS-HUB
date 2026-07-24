# Project Report (Draft) — Business Hub

> Format: JAIN Online Annexure 5. This is a **content scaffold** for all five chapters,
> grounded in the current app. Expand each section, rewrite in your own words, insert the
> diagrams/tables noted in **[FIGURE]/[TABLE]** markers, and format to spec (Times New Roman,
> 1.5 spacing, 45–65 pages). Chapter 2 (literature review) is intentionally light here — see
> `04-literature-review-and-references.md` for the material to build it from.

---

## Chapter 1 — Introduction, Scope and Background (target 9–15 pp)

### 1.1 Overview of the Project / Business Case
Business Hub is a retail operations platform for small and medium Indian shops. It combines
point of sale, inventory, customer credit (*khata*), GST-compliant billing, and reporting into a
single mobile-first application backed by a cloud service. The project is motivated by two
realities of Indian SME retail: connectivity is intermittent, and GST compliance is mandatory.
The rationale is to give a shop owner software that keeps the counter moving without a network
and produces compliant tax records automatically.

*Domain / industry overview:* India's retail sector is dominated by small, owner-operated shops
(*kirana* and specialty stores). Since the 2017 GST rollout, even small businesses must issue
tax-correct invoices and file periodic returns (GSTR-1, GSTR-3B). Digital payments (UPI) are now
ubiquitous. Yet affordable POS tools frequently assume constant connectivity, creating a gap
this project targets. *(Expand with a PESTEL note: Political — GST/e-invoicing mandates;
Economic — thin margins, price sensitivity; Social — UPI adoption, smartphone penetration;
Technological — intermittent 4G, Android-first; Environmental/Legal — data-protection and tax
record-keeping obligations.)*

### 1.2 Problem Definition
The project builds a mobile POS and business-management application. The existing situation for a
typical shop is a mix of paper *khata*, a basic calculator or a cloud billing app that fails when
the connection drops, and manual GST computation. The problems: sales stall when offline; stock
is inaccurate; customer dues are untracked; and GST returns are laborious and error-prone. These
justify a purpose-built, offline-first, GST-aware system.

### 1.3 Project Scope
The system delivers: (1) an offline-first POS; (2) event-sourced inventory; (3) a customer-credit
ledger; (4) GST-accurate billing with HSN and GSTR-1/3B export; (5) reliable two-way sync to a
multi-tenant backend; (6) role-based access; (7) reporting (revenue, P&L, sync posture).

**Aim:** enable a shop to sell quickly offline, know its stock accurately, track who owes what,
understand daily performance, and stay GST-compliant.

**Objectives:** *(restate the three synopsis objectives here.)*

**[FIGURE 1.1]** High-level system context diagram (mobile ↔ backend ↔ database).

---

## Chapter 2 — Review of Literature (target 9–12 pp)

> Build this chapter from `04-literature-review-and-references.md`. Structure:

### 2.1 Domain / Topic-Specific Review
Review, with citations, the four pillars this project stands on:
1. **Offline-first / local-first software** and synchronisation (event-driven sync, outbox
   pattern, conflict handling, CRDTs as context).
2. **Event sourcing** as a persistence pattern for auditable, append-only domain state.
3. **POS and SME digitisation in India** — adoption barriers, connectivity, informal credit.
4. **GST and e-invoicing** — compliance requirements driving software design.

### 2.2 Gap Analysis
Synthesise the above into the gap this project fills: existing affordable POS tools are
cloud-first (fail offline) or too heavy (ERP); few combine a *genuinely* offline-first design
with correct Indian GST modelling and verifiable no-loss/no-duplication sync. State clearly how
Business Hub addresses that gap.

### 2.3 Feasibility Analysis (SWOT + feasibility)
- **Technical feasibility:** mature stacks (Flutter, Django, PostgreSQL); the hard problem
  (idempotent sync) is solved and tested.
- **Operational feasibility:** runs on a low-cost Android phone; usable by non-technical staff.
- **Economic feasibility:** open-source stack; low per-shop cost via multi-tenancy.
- **Ethical/legal feasibility:** PII encrypted at rest; tenant isolation; GST record-keeping met.
- **SWOT:** Strengths — offline-first, GST-native; Weaknesses — hosted deployment pending;
  Opportunities — large under-served SME market; Threats — established billing apps.

---

## Chapter 3 — Project Planning and Methodology (target 3–5 pp)

### 3.1 Project Planning
**[FIGURE 3.1]** Gantt chart across the 8 weeks (use the Week 1–8 plan from the synopsis).

- **Communication plan:** solo project with faculty-guide checkpoints on alternate weekends;
  progress tracked in Git commit history and `docs/`.
- **Acceptance plan:** each objective has a pass/fail acceptance criterion (offline usability;
  zero lost/duplicated transactions; GST-accurate totals; correct running balances).
- **Resource plan:** one developer; an Android device; a laptop running the backend; open-source
  tooling; Git for version control.
- **Risk management plan:** *(tabulate)* — e.g. sync data-loss risk → mitigated by idempotency +
  upsert-merge + dead-letter queue and tests; scope risk → mitigated by vertical slices;
  dependency risk → pinned versions; device/hardware risk → seeded demo data + emulator fallback.

**[TABLE 3.1]** Risk register (risk · likelihood · impact · mitigation).

### 3.2 Methodology
Comparative note: Waterfall would front-load an unverifiable sync contract; pure Agile/Scrum is
heavy for a solo project. An **iterative, backend-first, vertical-slice** method was chosen —
justify: it settles the synchronisation contract early (the riskiest part), then delivers each
feature end-to-end with continuous on-device verification. State why this fits an offline-first
system better than the alternatives.

---

## Chapter 4 — Data Analysis, Design and Implementation (target 20–25 pp)

> This is the heaviest chapter. For a build project, read "Data Analysis" as **requirements
> analysis + design + testing/verification results**, presented as tables and charts.

### 4.1 Requirement Analysis
**4.1.1 Data collection.** Primary: on-device runs, automated test suites, sync verification.
Secondary: domain literature (Chapter 2).

**4.1.2 Requirements specification.**
- **Functional:** create/scan items; ring up sales offline; split payments and UPI QR;
  record customer credit and payments; auto-increment stock on purchase; compute GST; export
  GSTR-1/3B; sync two-way; role-based access; import CSV/XLSX.
- **Non-functional:**
  - *Performance:* counter operations are instant (local writes); sync runs in the background.
  - *Reliability:* no lost or duplicated transactions across offline/online transitions.
  - *Security:* PII encrypted at rest; tenant isolation; RBAC; biometric override for sensitive
    actions.
  - *Usability:* usable by non-technical staff; mobile/tablet form factors.
  - *Maintainability:* modular apps; automated tests; pinned dependencies.
  - *Database:* durable, auditable (event-sourced), fractional-safe quantities.

**[TABLE 4.1]** Functional requirements traceability (requirement → module → test).

### 4.2 System Design

**4.2.1 Architecture (logic design).**
Three tiers: Flutter client (offline-first) → Django/DRF API (source of truth) → PostgreSQL.
Async work (projections, ERP sync) via Celery/Redis. Connection pooling via pgbouncer.
**[FIGURE 4.1]** Component/architecture diagram.

**4.2.2 Data design (database).**
Row-level multi-tenancy: `Shop` is the tenant; `ShopMembership` binds a user to a shop with a
role; every domain table carries a `shop` foreign key. Stock is **event-sourced**: an
`InventoryStockLedger` of `quantity_delta` rows (Decimal 12,3, fractional-safe), so quantity is
always the sum of deltas and fully auditable. Customer credit uses a parallel ledger.
**[FIGURE 4.2]** Entity-Relationship diagram (from `docs/data-model-erd.md`).
**[TABLE 4.2]** Data dictionary for the core entities (Shop, ShopMembership, InventoryItem,
InventoryStockLedger, Customer, CustomerLedgerEntry, Sale, SaleItem, Supplier, Purchase).

**4.2.3 Process design (offline-first sync).**
The mobile app writes to local SQLite first, then enqueues an **idempotent command** in a
`commerce_outbox` table. A sync coordinator pushes pending commands (with exponential backoff and
an attempt ceiling), and the backend deduplicates replays via each command's idempotency key, so
retries never double-post. Permanently-rejected (4xx) commands are moved to a **dead-letter
queue** so one bad command cannot block the queue. The pull path is an **upsert-merge** that never
overwrites unsynced local edits.
**[FIGURE 4.3]** Sequence diagram: offline sale → outbox → push → dedupe → pull-merge.
**[FIGURE 4.4]** State diagram of a command (local → queued → syncing → synced / dead-letter).

**4.2.4 Interface design.**
Mobile screens: Home/Dashboard, POS (quick-key grid, scanner), Inventory, Customers (khata),
History, Reports, Settings/Import. **[FIGURE 4.5]** Key screen images / use-case diagram.

### 4.3 Implementation
- **Backend:** 16 Django apps (`users`, `shops`, `inventory`, `customers`, `sales`, `purchases`,
  `payments`, `expenses`, `attendance`, `projections`, `erpnext`, `audit`, `jobs`, `health`,
  `common`). Multi-tenant guard `get_membership_or_403` enforces the tenant boundary and minimum
  role on every shop-scoped view. GST computed server-side (CGST/SGST/IGST) with GSTR-1/3B export.
- **Mobile:** 10 feature modules (`pos`, `inventory`, `customers`, `history`, `reports`,
  `dashboard`, `home`, `auth`, `settings`, `shell`). Offline store via Drift/SQLite; sync via the
  coordinator; thermal + PDF receipts; UPI QR; biometric override; universal CSV/XLSX import with
  auto-detection.
- **Scale of implementation:** ~50,900 lines of Dart (mobile) and ~29,800 lines of Python
  (backend). *(Verify counts before quoting; see repo.)*

### 4.4 Testing and Analysis of Results

> This subsection is your empirical "data analysis" — present it with tables and charts.

**[TABLE 4.3]** Test summary — mobile: 232 tests passing across 21 test files; backend: 116 test
files. Break down by area (pricing, sync/backoff, GST, import date-parsing, dedupe, khata,
readiness gating).

**[TABLE 4.4]** Objective-vs-outcome matrix:

| Objective | Acceptance criterion | Result |
|-----------|---------------------|--------|
| Offline-first POS | Sale completes with network off | Met — local write is instant; sale queued |
| No lost transactions | Offline sales appear after reconnect | Met — outbox flush + upsert-merge |
| No duplicated transactions | Re-sync / re-import does not double-post | Met — idempotency key + content-derived import IDs |
| GST accuracy | CGST/SGST/IGST + totals correct | Met — server-computed; verified in tests |
| Correct khata | Running balance matches ledger | Met — event-sourced customer ledger |
| Tenant isolation | No cross-shop data access | Met — membership-filtered queries |

**[CHART 4.1]** Bar chart of tests by category. **[CHART 4.2]** Pass-rate / verification outcomes.

Interpret each result below its table/chart: what it shows, and how it maps back to the objective.

---

## Chapter 5 — Results, Findings, Recommendations, Future Scope and Conclusion (target 3–5 pp)

### 5.1 Results of the Work
All three objectives were met. The application runs on a physical Android device from a signed
build, transacts fully offline, and reconciles cleanly on reconnect. Automated tests
(232 mobile, 116 backend test files) pass, and on-device verification confirmed the sync
guarantees. *(If any objective is partially met — e.g. hosted deployment — say so and justify.)*

### 5.2 Findings Based on Analysis of Data
- The idempotent-outbox + upsert-merge design demonstrably prevents both loss and duplication of
  transactions across offline/online transitions.
- Event-sourced stock gives an auditable, fractional-safe quantity that suits by-weight retail.
- Server-side GST computation yields consistent, exportable returns.
- Row-level multi-tenancy isolates shops on a shared backend without a per-tenant schema.

### 5.3 Recommendations Based on Findings
The architecture is a reusable template for offline-first, multi-tenant line-of-business apps.
For deployment, host the backend behind managed PostgreSQL with connection pooling; for wider
adoption, add multi-language support and analytics. The design generalises beyond retail to any
domain needing offline transactions with a compliant central record.

### 5.4 / 5.5 Suggestions for Improvement
- Complete the Firebase → JWT authentication migration.
- Add production observability dashboards and a load test at scale.
- Harden the desktop shell (currently wraps the legacy web app) or retire it.

### 5.6 Scope for Future Work
Host the backend for true multi-device sync; multi-language UI; demand forecasting and automatic
reorder points; optional ERPNext interoperability; a production-scale performance study.

### 5.7 Conclusion
Business Hub shows that a small retailer can have software that is fast offline, safe online, and
GST-compliant by default. The project delivers a verified offline-first architecture, a correct
retail domain model, and a demonstrable working product on real hardware, meeting its stated
objectives and providing a reusable reference for local-first, multi-tenant business software.
The principal remaining work is hosted deployment and broader language and analytics coverage.

---

## End Section
- **Bibliography** — see `04-literature-review-and-references.md` (APA; verify each entry).
- **Appendices** — key code excerpts (sync coordinator, multi-tenant guard), ER diagram, screen
  images, test output.
- **Annexures** — plagiarism report summary (attach before submission).
