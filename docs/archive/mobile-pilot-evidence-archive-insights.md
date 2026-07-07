# Mobile Pilot Evidence Archive Insights

## Purpose

The mobile evidence tracker now gives rollout leads a short archive-health view in addition to raw archived sessions.

This is for the moment when a lead asks:

- are recent shifts closing cleanly?
- are we still seeing missing core evidence?
- do I need the full archive pack, or only the recent posture?

## What the app now shows

Inside the Settings evidence tracker panel, the device now exposes:

- `Archive posture`
- `Archive summary`
- a short archive guidance note
- `Copy archive insights`

The goal is to make recent rollout quality visible without forcing the operator to read the full archive pack line by line.

## Archive posture meanings

- `No trend yet`
  - no archived session history exists on this device yet
- `Healthy trend`
  - recent archived sessions closed with all core evidence captured
- `Mixed trend`
  - some recent archived sessions were clean, but at least one still closed with missing core evidence
- `Attention trend`
  - recent archived sessions are consistently closing with missing core evidence
- `Recovering trend`
  - older archived sessions needed attention, but the most recent archive set looks healthier

## When to use it

Use `Copy archive insights` when:

- the rollout lead wants a short trend summary
- a shift handoff needs context, but not the full archive pack
- the team wants to know if recent device evidence posture is improving or slipping

Use the full archive pack instead when:

- you need the detailed archived session list
- support or audit wants the raw archive content
- you are comparing multiple sessions in detail

## Recommended use

1. Start a named evidence session at the beginning of a real shift or rollout wave.
2. Let the app capture exports normally as readiness, smoke, recovery, closeout, or escalation actions are used.
3. At handoff time, use `Copy archive insights` first for a short operational summary.
4. Use `Copy full archive pack` only when the rollout lead needs the full archived session detail.
