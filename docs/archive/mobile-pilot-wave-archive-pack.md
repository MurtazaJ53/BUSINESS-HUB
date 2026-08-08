# Mobile Pilot Wave Archive Pack

## Purpose

The mobile app now produces a final wave archive pack.

This is the export you use when the rollout lead wants:

- the final signoff result
- the closeout posture
- the recent evidence-session archive
- one permanent device-side rollout archive block

## What it combines

The wave archive pack sits above:

- wave signoff pack
- evidence tracker archive pack
- recent archive trend

This makes it the final long-form export for the permanent rollout archive.

## Archive outcomes

- `ARCHIVE READY`
  - signoff is clean
  - the signoff artifact was captured
  - the device wave can be archived as final

- `ARCHIVE WITH ATTENTION`
  - the wave can be archived
  - but the archive should preserve monitoring or attention context

- `ARCHIVE INCOMPLETE`
  - the final signoff artifact is still missing
  - or signoff is still incomplete

- `ARCHIVE BLOCKED`
  - the wave is still blocked or incident-prone
  - it should not be archived as final

## Recommended use

1. Capture the wave signoff pack first.
2. Use `Copy wave archive pack` as the permanent record export.
3. If the archive result is `ARCHIVE INCOMPLETE` or `ARCHIVE BLOCKED`, keep the wave open and fix the underlying problem first.
