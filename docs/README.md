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
28. [Phase 7 Live Rollout Runbook](./phase-7-live-rollout-runbook.md)
29. [Master Launch and Rollout Checklist](./master-launch-and-rollout-checklist.md)
30. [Phase 8 Steady-State Operations Runbook](./phase-8-steady-state-operations-runbook.md)
31. [SLO and Error Budget Review Cadence](./slo-and-error-budget-review-cadence.md)
32. [Incident and Postmortem Cadence](./incident-and-postmortem-cadence.md)
33. [Cost and Capacity Review Cadence](./cost-and-capacity-review-cadence.md)
34. [Dependency Upgrade Policy](./dependency-upgrade-policy.md)
35. [Phase 8 Quarterly Architecture Review Checklist](./phase-8-quarterly-architecture-review-checklist.md)
36. [Mobile Release Readiness Checklist](./mobile-release-readiness-checklist.md)
37. [Mobile Release Notes Template](./mobile-release-notes-template.md)
38. [Mobile Launch Operations Runbook](./mobile-launch-operations-runbook.md)
39. [Mobile Local Validation Runner](./mobile-local-validation-runner.md)
40. [Mobile Local Release Prep Runner](./mobile-local-release-prep-runner.md)
41. [Mobile Local Release Runner](./mobile-local-release-runner.md)
42. [Mobile Local Release Bundle Runner](./mobile-local-release-bundle-runner.md)
43. [Mobile Local Release Registry Runner](./mobile-local-release-registry-runner.md)
44. [Mobile Local Release Tag Runner](./mobile-local-release-tag-runner.md)
45. [Mobile Local Release Handoff Runner](./mobile-local-release-handoff-runner.md)
46. [Mobile Local Release Pipeline Runner](./mobile-local-release-pipeline-runner.md)
47. [Mobile Pilot Handoff Pack](./mobile-pilot-handoff-pack.md)
48. [Mobile Pilot Readiness Signoff](./mobile-pilot-readiness-signoff.md)
49. [Mobile Pilot Smoke Sheet](./mobile-pilot-smoke-sheet.md)
50. [Mobile Pilot Recovery Playbook](./mobile-pilot-recovery-playbook.md)
51. [Mobile Pilot Shift Closeout](./mobile-pilot-shift-closeout.md)
52. [Mobile Pilot Rollout Evidence Pack](./mobile-pilot-rollout-evidence-pack.md)
53. [Mobile Pilot Incident Escalation Pack](./mobile-pilot-incident-escalation-pack.md)
54. [Mobile Operator Action Center](./mobile-operator-action-center.md)
55. [Mobile Pilot Evidence Tracker](./mobile-pilot-evidence-tracker.md)
56. [Mobile Pilot Evidence Persistence](./mobile-pilot-evidence-persistence.md)
57. [Mobile Pilot Evidence Sessions](./mobile-pilot-evidence-sessions.md)
58. [Mobile Pilot Evidence Session History](./mobile-pilot-evidence-session-history.md)
59. [Mobile Pilot Evidence Archive Control](./mobile-pilot-evidence-archive-control.md)
60. [Mobile Pilot Evidence Archive Insights](./mobile-pilot-evidence-archive-insights.md)
61. [Mobile Pilot Rollout Decision Summary](./mobile-pilot-rollout-decision-summary.md)
62. [Mobile Pilot Wave Closeout Readiness](./mobile-pilot-wave-closeout-readiness.md)
63. [Mobile Pilot Wave Signoff Pack](./mobile-pilot-wave-signoff-pack.md)
64. [Mobile Pilot Wave Archive Pack](./mobile-pilot-wave-archive-pack.md)

### Existing strategy docs

65. [Flutter Mobile Migration Plan](./flutter-mobile-migration.md)
66. [Global Scale Blueprint](./global-scale-blueprint.md)
67. [Scale Certification Checklist](./scale-certification-checklist.md)
68. [ERPNext Fit-Gap Analysis](./erpnext-fit-gap-analysis.md)
69. [ERPNext Target Architecture](./erpnext-target-architecture.md)
70. [ERPNext Proof-of-Concept Runbook](./erpnext-proof-of-concept-runbook.md)
71. [ERPNext Execution Layer](./erpnext-execution-layer.md)
72. [ERPNext Handover Runbook](./erpnext-handover-runbook.md)
73. [ERPNext Local Demo Runbook](./erpnext-local-demo-runbook.md)

## Current truth

As of May 12, 2026:
- the web/admin app is still the most complete Business Hub surface
- the Flutter mobile app is the new performance-focused mobile path
- Flutter mobile is not yet at full feature parity with the old app
- Firestore is the shared cloud backbone
- local SQLite remains the speed layer on clients
- PostgreSQL + Django is the recommended final backend direction
- ERPNext is now documented as an evaluation path for back-office acceleration, not as an automatic full UI replacement
- the migration control plane now includes Phase 7 rollout and scale-optimization signoff surfaces, while Phase 8 defines steady-state operating posture

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
- then Mobile Local Validation Runner
- then Mobile Local Release Prep Runner
- then Mobile Local Release Runner
- then Mobile Local Release Bundle Runner
- then Mobile Local Release Registry Runner
- then Mobile Local Release Tag Runner
- then Mobile Local Release Handoff Runner
- then Mobile Local Release Pipeline Runner
- then Operations Runbook
- then Mobile Release Readiness Checklist
- then Mobile Launch Operations Runbook
- then Mobile Pilot Handoff Pack
- then Mobile Pilot Readiness Signoff
- then Mobile Pilot Smoke Sheet
- then Mobile Pilot Recovery Playbook
- then Mobile Pilot Shift Closeout
- then Mobile Pilot Rollout Evidence Pack
- then Mobile Pilot Incident Escalation Pack
- then Mobile Operator Action Center
- then Mobile Pilot Evidence Tracker
- then Mobile Pilot Evidence Persistence
- then Mobile Pilot Evidence Sessions
- then Mobile Pilot Evidence Session History
- then Mobile Pilot Evidence Archive Control
- then Mobile Pilot Evidence Archive Insights
- then Mobile Pilot Rollout Decision Summary
- then Mobile Pilot Wave Closeout Readiness
- then Mobile Pilot Wave Signoff Pack
- then Mobile Pilot Wave Archive Pack

## Notes

This docs set is based on the real repository state, not an ideal future-state rewrite.

That means it intentionally documents:
- current strengths
- current gaps
- migration-phase limits
- what still needs work before full production cutover
