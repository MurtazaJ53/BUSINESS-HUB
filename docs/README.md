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
6. [Data Model and ERD](./data-model-erd.md)
7. [Backend Services and Functions](./backend-services-and-functions.md)
8. [Sync Parity Matrix](./sync-parity-matrix.md)

### Release and operations

9. [Deployment and Release Runbook](./deployment-release-runbook.md)
10. [Testing and QA Plan](./testing-qa-plan.md)
11. [Mobile Cutover Checklist](./mobile-cutover-checklist.md)
12. [Operations Runbook](./operations-runbook.md)

### Existing strategy docs

13. [Flutter Mobile Migration Plan](./flutter-mobile-migration.md)
14. [Global Scale Blueprint](./global-scale-blueprint.md)
15. [Scale Certification Checklist](./scale-certification-checklist.md)

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
