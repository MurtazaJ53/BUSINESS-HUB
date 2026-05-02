# SLO and Error Budget Review Cadence

## Purpose

This document defines how Business Hub should review service levels and error
budget usage during steady-state operations.

## Core SLOs

At minimum, review:

- API availability
- admin surface usability
- POS replay success rate
- reconciliation critical-event rate
- projection freshness
- worker/queue delay

## Review cadence

### Weekly

- inspect the latest SLO trend
- identify any growing error-budget burn
- flag any service that is drifting toward an incident pattern

### Monthly

- review formal error-budget consumption
- decide whether the platform can continue normal feature work
- decide whether reliability work needs to be prioritized

## Escalation rules

If error budget is being consumed too fast:

- slow feature rollout
- prioritize reliability fixes
- require explicit approval before adding risky operational change

If SLOs are green consistently:

- continue normal product delivery
- keep monitoring discipline in place

## Required output

Each review should end with:

- healthy
- watch closely
- reliability focus required

## Final rule

SLOs are not dashboard decoration.

They are the rule set that decides whether Business Hub is safe to keep changing.
