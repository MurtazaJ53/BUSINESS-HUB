# Mobile Pilot Wave Signoff Pack

## Purpose

The mobile app now produces a final wave signoff pack.

This is the device-side answer to:

- can we archive this wave as signed off?
- is signoff allowed only with monitoring?
- is signoff incomplete because evidence is still missing?
- is signoff blocked because the wave should stay open?

## What it combines

The signoff pack sits above:

- rollout decision summary
- wave closeout readiness
- evidence tracker posture
- operator action posture

This gives the rollout lead one final handoff package instead of several smaller exports.

## Signoff outcomes

- `SIGNOFF READY`
  - the device is in a clean handoff posture
  - the wave can be archived as signed off

- `SIGNOFF WITH MONITORING`
  - handoff is possible
  - but the rollout lead should keep explicit monitoring in place

- `SIGNOFF INCOMPLETE`
  - closeout evidence is still incomplete
  - the wave should not be archived as fully signed off yet

- `SIGNOFF BLOCKED`
  - the device is still in blocked or incident posture
  - signoff should not happen

## Recommended use

1. Capture the rollout decision summary.
2. Capture wave closeout readiness.
3. Use `Copy wave signoff pack` as the final device artifact for the rollout archive.
4. If the signoff result is `SIGNOFF INCOMPLETE` or `SIGNOFF BLOCKED`, keep the wave open until the underlying problem is resolved.
