# Business Hub Domain Ownership Matrix

## Purpose

This document defines who owns each business domain in the recommended Business Hub + Frappe + ERPNext model.

The key rule is:

**One domain must have one clear authoritative write owner.**

That does not mean only one system ever touches the data, but it does mean only one system is the final authority for business correctness.

## Ownership model

### Business Hub native

Business Hub owns the domain logic, client workflows, and product experience.

### Frappe-backed

Business Hub still owns the product boundary, but the underlying operational data/services are implemented through curated Frappe app structures.

### ERPNext-backed

Business Hub owns the product boundary, but ERPNext is the authoritative business engine or ledger for that domain.

## Domain ownership matrix

| Domain | UI owner | Write authority | Read strategy | Recommended platform | Notes |
| --- | --- | --- | --- | --- | --- |
| POS cart state | Business Hub | Business Hub | Local-first projection | Business Hub native | Must stay fast and offline-friendly |
| Sale creation workflow | Business Hub | Business Hub -> posted to ERP layer | Local-first with backend confirmation | Business Hub native | UX must stay custom |
| Receipt presentation | Business Hub | Business Hub | Projection/read model | Business Hub native | Never blocked on ERP UI |
| Product catalog browsing | Business Hub | Business Hub service layer | Projection/read model | Frappe-backed | Curated schema allowed |
| Product master governance | Business Hub | Frappe or ERPNext depending plan | Projection/read model | Frappe-backed by default | Keep UI independent of DocTypes |
| Inventory quantity projection | Business Hub | Business Hub projection with authoritative stock source | Projection/read model | Frappe-backed by default | Fast reads required |
| Stock ledger / valuation | Hidden | ERPNext if advanced stock discipline enabled | Summaries into Business Hub | ERPNext-backed for advanced clients | Not normal client UI |
| Customer lookup UX | Business Hub | Business Hub service layer | Projection/read model | Frappe-backed | Fast cashier lookup matters |
| Customer credit / dues UX | Business Hub | Business Hub service layer with ERP sync where needed | Projection/read model | Frappe-backed by default | Keep collection ergonomics custom |
| Customer accounting balance authority | Hidden | ERPNext where finance depth is active | Summary into Business Hub | ERPNext-backed for Pro | Do not expose raw ledger screens |
| Expenses | Business Hub | Business Hub or curated Frappe app | Simple reporting read model | Frappe-backed | Keep lightweight |
| Attendance | Business Hub | Business Hub or curated Frappe app | Simple reporting read model | Frappe-backed | Avoid HR-system complexity |
| Staff roles and permissions | Business Hub | Business Hub authority | Shared to supporting layers | Business Hub native | Product permission model stays central |
| Supplier master | Hidden back-office | ERPNext when purchase flow is active | Summary into Business Hub | ERPNext-backed for Growth/Pro | Not top-level for all clients |
| Purchase workflow | Hidden back-office | ERPNext for advanced purchase control | Summary into Business Hub | ERPNext-backed | Keep client view curated |
| Supplier payments | Hidden back-office | ERPNext | Summary into Business Hub | ERPNext-backed | Finance-heavy |
| Receivables / payables | Hidden back-office | ERPNext | Summary into Business Hub | ERPNext-backed | Strong ERP fit |
| Accounting entries | Internal or owner summary only | ERPNext | Summary into Business Hub | ERPNext-backed | Should not be directly edited in client UI |
| Tax mapping | Internal-only | ERPNext / support setup | Rarely surfaced | ERPNext-backed | Setup only |
| Dashboards and owner summaries | Business Hub | Business Hub projection layer | Read models and aggregates | Business Hub native | Product differentiation zone |
| Reports for normal clients | Business Hub | Business Hub projection layer | Curated reporting | Business Hub native | Should not feel like report-builder software |
| ERP bindings and sync controls | Internal-only | Business Hub backend | Internal operator reads | Business Hub internal control plane | Keep hidden |

## Default ownership recommendation

### Business Hub should clearly own

- mobile and web workflows
- POS UX
- customer interaction UX
- owner dashboard UX
- plan and permission logic
- product navigation
- feature flags
- reporting experience

### Frappe should support

- custom domain models where Business Hub needs structured platform services
- operational APIs behind Business Hub contracts
- curated back-office workflows that do not justify full ERPNext complexity

### ERPNext should own only where it is strongest

- accounting
- payables and receivables
- purchasing
- supplier finance
- stock valuation and disciplined ERP inventory flows

## Anti-patterns to avoid

1. Business Hub and ERPNext both editing the same domain independently.
2. Mobile directly writing raw ERP documents.
3. Owners using ERP forms because Business Hub UI was left incomplete.
4. Letting plan tiers drift into technical system boundaries.

## UI implication

The UI should never reveal ownership complexity directly.

Clients should see:

- sales
- stock
- customers
- dues
- expenses
- reports

They should not need to know:

- whether a purchase record is backed by ERPNext
- whether a customer balance is finalized through ERPNext accounting
- how stock valuation is implemented

## Acceptance criteria

- each domain has one explicit final write authority
- product and engineering teams can answer "who owns this?" in one sentence
- there is no ambiguous shared-write zone
