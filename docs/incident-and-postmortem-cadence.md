# Incident and Postmortem Cadence

## Purpose

This document defines the steady-state incident review rhythm for Business Hub.

## When to trigger incident review

Run incident review for:

- customer-visible outages
- failed commerce replay bursts
- reconciliation spikes
- data integrity scares
- rollback-triggering events

## Immediate response expectations

- assign an incident owner
- stabilize first
- preserve evidence
- communicate clearly

## Postmortem cadence

### Within 24 hours

- capture a written incident summary
- classify impact
- identify affected surfaces

### Within 3 business days

- identify root cause
- list action items
- assign owners and due dates

### At weekly ops review

- review open postmortem actions
- confirm repeated incidents are not being normalized

## Minimum postmortem fields

- what happened
- when it started
- when it ended
- customer impact
- technical root cause
- why detection or prevention failed
- corrective actions

## Final rule

No major incident is complete until:

- the system is stable
- the written postmortem exists
- follow-up work has owners
