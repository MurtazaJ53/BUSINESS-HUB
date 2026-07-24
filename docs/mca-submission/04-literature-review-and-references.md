# Chapter 2 Material — Literature Review & References

> This is the **only genuinely blank page** in your submission and it is graded, so start here.
> Below is a structure, the four themes to cover, and **representative real sources** to build
> from. **You must open and verify every source** and write the full APA entry yourself — do not
> cite anything you have not read. I have deliberately not fabricated DOIs or page numbers.

---

## How to write this chapter (≈ 9–12 pages)

For each of the four themes: (1) summarise what the literature says, (2) relate it to your
project, (3) note what it does *not* solve. Then a **gap analysis** that names precisely the
space Business Hub fills. Aim for **12–18 cited works** total (3–5 per theme) to signal
"Quality of References" on the rubric.

---

## Theme 1 — Offline-first / local-first software & synchronisation

**What to argue:** cloud-first apps fail on intermittent networks; a body of work advocates
treating the local device as authoritative and reconciling asynchronously. Cover the **outbox
pattern**, **idempotent commands / exactly-once effects**, and **conflict handling** (last-writer-
wins vs merge vs CRDTs). Relate directly to your `commerce_outbox` + upsert-merge design.

**Representative sources to verify:**
- Kleppmann, M., et al. — *"Local-first software: You own your data, in spite of the cloud"* (Ink
  & Switch essay / Onward! 2019). The canonical statement of the local-first principles.
- Kleppmann, M. — *Designing Data-Intensive Applications* (O'Reilly). Chapters on replication,
  consistency, and idempotence — background for your sync guarantees.
- Richardson, C. — *Microservices Patterns* (Manning): the **Transactional Outbox** pattern.
- Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. — foundational **CRDT** papers (INRIA,
  2011) — cite as context for conflict-free merge even if you use upsert-merge, not CRDTs.

## Theme 2 — Event sourcing & auditable domain state

**What to argue:** storing state as an append-only log of events (rather than mutable rows) gives
auditability and temporal queries — exactly your `InventoryStockLedger` (quantity = Σ deltas) and
customer-credit ledger.

**Representative sources to verify:**
- Fowler, M. — *"Event Sourcing"* (martinfowler.com, 2005) and *"CQRS"*. The standard references.
- Young, G. — talks/writing on CQRS and event sourcing.
- Vernon, V. — *Implementing Domain-Driven Design* (Addison-Wesley): event sourcing in context.

## Theme 3 — POS & SME retail digitisation in India

**What to argue:** small Indian retailers face connectivity, cost, and usability barriers to
digitisation; informal credit (*khata*) and cash/UPI coexist. Justify why an offline-first,
low-cost, khata-aware design fits this market.

**Sources to find (search these):** peer-reviewed journal articles (UGC-CARE / Scopus) on
*"digital payment adoption among Indian small retailers"*, *"kirana store digitisation"*, and
industry/economic reports on Indian retail and UPI adoption (RBI / NPCI publications). Prefer
journal articles over blog posts for the "Quality of References" score.

## Theme 4 — GST, e-invoicing & compliance-driven software

**What to argue:** GST (2017) makes tax-correct invoicing and periodic returns (GSTR-1, GSTR-3B)
mandatory even for small businesses, driving demand for software that computes CGST/SGST/IGST and
HSN correctly. This motivates your server-side GST engine and filing-pack export.

**Sources to find:** GST Council / CBIC official documentation on GSTR-1 and GSTR-3B; peer-reviewed
articles on *"GST compliance for MSMEs in India"* and *"e-invoicing adoption"*.

---

## Gap analysis (write this yourself, ~1 page)

Synthesise the four themes into a single claim, e.g.:

> "The literature establishes strong foundations for offline-first synchronisation (Theme 1) and
> auditable state via event sourcing (Theme 2), and documents both the digitisation barriers of
> Indian SME retail (Theme 3) and the compliance demands of GST (Theme 4). However, few existing
> systems combine a *genuinely* offline-first design (where the local store is authoritative, not
> a cache) with a correct, India-specific GST domain model and *verified* no-loss / no-duplication
> synchronisation. Business Hub addresses this gap."

---

## Reference list (APA) — TEMPLATE, fill in verified details

Do **not** submit these as-is. Replace each with the full, verified APA entry after you read the
source.

```
Author, A. A., & Author, B. B. (Year). Title of the work. Publisher/Journal, Volume(Issue),
    pages. https://doi.org/xxxxx
```

Suggested minimum set (verify each): 1 local-first source, 1 data-systems/idempotence source,
1 outbox-pattern source, 1 event-sourcing source, 2 CRDT/consistency sources, 3–4 Indian
SME/POS/UPI journal articles, 2–3 GST/e-invoicing official + academic sources.

> **Integrity reminder:** the rubric weighs "Quality of References". Real, verifiable,
> peer-reviewed citations in correct APA format score far better than a long list of blogs — and
> fabricated citations will fail the check outright. Confirm every entry.
