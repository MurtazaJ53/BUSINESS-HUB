# Business Hub Documentation Pack

## Purpose

This folder contains the current working documentation set for Business Hub.

It is designed to support:
- product planning
- engineering implementation
- QA and UAT
- deployment and release
- Flutter mobile migration
- operations and troubleshooting

## Recommended reading order

### Product and business

1. [Business Hub Complete Platform Handbook](./business-hub-complete-platform-handbook.md)
2. [Implementation Roadmap](./implementation-roadmap.md)
3. [Product Overview](./product-overview.md)
4. [Product Requirements](./product-requirements-prd.md)
5. [User Roles and Permissions](./user-roles-and-permissions.md)

### System and engineering

6. [Architecture Overview](./architecture-overview.md)
7. [Final Architecture Blueprint](./final-architecture-blueprint.md)
8. [Firebase to PostgreSQL Migration Plan](./firebase-to-postgres-migration-plan.md)
9. [Firebase to PostgreSQL Schema Map](./firebase-to-postgres-schema-map.md)
10. [Platform Scenarios and Operational Flows](./platform-scenarios-and-operational-flows.md)
11. [Diagram Pack](./diagrams/README.md)
12. [Target Platform Architecture](./target-platform-architecture.md)
13. [High-Scale Global Architecture](./high-scale-global-architecture.md)
14. [Ultra-High-Write Transaction Architecture](./ultra-high-write-transaction-architecture.md)
15. [Production Control Plane Architecture](./production-control-plane-architecture.md)
16. [Data Model and ERD](./data-model-erd.md)
17. [Backend Services and Functions](./backend-services-and-functions.md)
18. [Sync Parity Matrix](./sync-parity-matrix.md)

### Release and operations

19. [Deployment and Release Runbook](./deployment-release-runbook.md)
20. [Testing and QA Plan](./testing-qa-plan.md)
21. [Mobile Cutover Checklist](./mobile-cutover-checklist.md)
22. [Operations Runbook](./operations-runbook.md)
23. [Legacy Client Compatibility Policy](./legacy-client-compatibility-policy.md)
24. [Phase 3 Pilot Cutover Runbook](./phase-3-pilot-cutover-runbook.md)
25. [Phase 4 Commerce Cutover Runbook](./phase-4-commerce-cutover-runbook.md)
26. [Phase 5 Retirement Runbook](./phase-5-retirement-runbook.md)
27. [Phase 6 Go-Live Runbook](./phase-6-go-live-runbook.md)

### Existing strategy docs

28. [Flutter Mobile Migration Plan](./flutter-mobile-migration.md)
29. [Global Scale Blueprint](./global-scale-blueprint.md)
30. [Scale Certification Checklist](./scale-certification-checklist.md)

## Current truth

As of April 29, 2026:
- the web/admin app is still the most complete Business Hub surface
- the Flutter mobile app is the new performance-focused mobile path
- Flutter mobile is not yet at full feature parity with the old app
- Firestore is the shared cloud backbone
- local SQLite remains the speed layer on clients
- PostgreSQL + Django is the recommended final backend direction
- the migration control plane now includes Phase 6 go-live and hypercare signoff surfaces

## Suggested use by audience

### Founder / product owner
- start with Business Hub Complete Platform Handbook
- then Implementation Roadmap
- then Product Overview
- then Product Requirements
- then Mobile Cutover Checklist

### Developer
- start with Business Hub Complete Platform Handbook
- then Implementation Roadmap
- then Architecture Overview
- then Diagram Pack
- then Target Platform Architecture
- then High-Scale Global Architecture
- then Ultra-High-Write Transaction Architecture
- then Production Control Plane Architecture
- then Data Model and ERD
- then Backend Services and Functions
- then Sync Parity Matrix

### QA / tester
- start with Testing and QA Plan
- then Product Requirements
- then Mobile Cutover Checklist

### Release / operations
- start with Deployment and Release Runbook
- then Operations Runbook

## Notes

This docs set is based on the real repository state, not an ideal future-state rewrite.

That means it intentionally documents:
- current strengths
- current gaps
- migration-phase limits
- what still needs work before full production cutover
