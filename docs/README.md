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

1. [Product Overview](./product-overview.md)
2. [Product Requirements](./product-requirements-prd.md)
3. [User Roles and Permissions](./user-roles-and-permissions.md)

### System and engineering

4. [Architecture Overview](./architecture-overview.md)
5. [Target Platform Architecture](./target-platform-architecture.md)
6. [High-Scale Global Architecture](./high-scale-global-architecture.md)
7. [Ultra-High-Write Transaction Architecture](./ultra-high-write-transaction-architecture.md)
8. [Production Control Plane Architecture](./production-control-plane-architecture.md)
9. [Data Model and ERD](./data-model-erd.md)
10. [Backend Services and Functions](./backend-services-and-functions.md)
11. [Sync Parity Matrix](./sync-parity-matrix.md)

### Release and operations

12. [Deployment and Release Runbook](./deployment-release-runbook.md)
13. [Testing and QA Plan](./testing-qa-plan.md)
14. [Mobile Cutover Checklist](./mobile-cutover-checklist.md)
15. [Operations Runbook](./operations-runbook.md)

### Existing strategy docs

16. [Flutter Mobile Migration Plan](./flutter-mobile-migration.md)
17. [Global Scale Blueprint](./global-scale-blueprint.md)
18. [Scale Certification Checklist](./scale-certification-checklist.md)

## Current truth

As of April 28, 2026:
- the web/admin app is still the most complete Business Hub surface
- the Flutter mobile app is the new performance-focused mobile path
- Flutter mobile is not yet at full feature parity with the old app
- Firestore is the shared cloud backbone
- local SQLite remains the speed layer on clients

## Suggested use by audience

### Founder / product owner
- start with Product Overview
- then Product Requirements
- then Mobile Cutover Checklist

### Developer
- start with Architecture Overview
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
