# Business Hub Support Playbook

## Purpose

This playbook defines how support should handle Business Hub issues while preserving the product boundary.

Clients should hear:

- Business Hub language
- plan-aware guidance
- next actions

Clients should not hear:

- raw ERP diagnostics
- migration internals
- backend implementation trivia

## Support levels

### Level 1: Product support

Handles:

- login issues
- navigation confusion
- missing expected pages
- normal workflow questions
- plan visibility questions
- simple sync reassurance

Target outcome:

- solve inside Business Hub language only

### Level 2: Operational support

Handles:

- blocked checkout
- inventory mismatch reports
- receipt review confusion
- customer balance questions
- expenses or attendance access issues

Target outcome:

- verify whether the issue is data, permissions, or user flow

### Level 3: Platform support

Handles:

- ERP-backed failures
- migration/admin surfaces
- feature flag mistakes
- broken bindings
- rollout-risk incidents

Target outcome:

- isolate platform cause without exposing internal detail to the client

## Standard support triage

1. Identify workspace.
2. Identify role.
3. Identify plan tier.
4. Identify screen and exact task.
5. Decide whether the issue is:
- training
- product bug
- data bug
- permissions/plan issue
- platform integration issue

## Response patterns

### If the feature is not in plan

Say:

- this workspace is on the current plan that includes these tools now
- the next plan adds the workflow you asked for
- we can help your owner review upgrade options

Do not say:

- the endpoint is blocked
- the serializer removed those fields

### If the issue is a product bug

Say:

- we confirmed the workflow is expected to work
- we are treating this as a product issue
- we will follow up with a fix or safe workaround

### If the issue is ERP-backed

Say:

- we confirmed the business record needs back-office review
- our team is checking the connected finance or purchasing layer
- we will return with the outcome in Business Hub terms

Do not say:

- your Sales Invoice failed because of DocType validation

## Required support records

- workspace name
- role
- plan tier
- affected surface
- task attempted
- visible error or wrong result
- whether revenue-impacting
- whether checkout-blocking

## Severity guide

### Critical

- cashier cannot complete sales
- payment recording is blocked
- major sync issue corrupts trust

### High

- managers cannot review stock or dues correctly
- owners cannot see expected reporting for their plan

### Medium

- upgrade copy, filters, summaries, or navigation issues

### Low

- wording, styling, and non-blocking visual polish

## Escalation rule

Escalate immediately if:

- checkout is blocked
- payment totals look wrong
- customer balances look wrong
- ERP-backed posting fails repeatedly
- a hidden internal page becomes visible to a client role

## Support acceptance

Support readiness is achieved when:

- L1 can answer plan and workflow questions without engineering help
- L2 can isolate product vs data vs permissions issues
- L3 can take ERP-backed issues without exposing ERP to the client
