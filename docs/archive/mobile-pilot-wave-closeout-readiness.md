# Mobile Pilot Wave Closeout Readiness

## Purpose

The mobile app now answers the final device-side closeout question:

- is this wave record ready to close?
- should it close with monitoring?
- do we still need more evidence?
- should we refuse closeout and keep the wave open?

## What it combines

Wave closeout readiness blends:

- rollout decision summary
- operator action posture
- recovery desk state
- evidence tracker completion
- archive trend

This turns many smaller exports into one direct closeout answer for the rollout lead.

## Statuses

- `READY FOR CLOSEOUT`
  - required evidence is present
  - current posture is stable enough to close the device wave record

- `CLOSEOUT WITH MONITORING`
  - the device can be handed off
  - but rollout should remain under monitoring before the record is considered fully quiet

- `CAPTURE MORE EVIDENCE`
  - one or more required closeout artifacts are still missing
  - closeout should wait until those artifacts are captured

- `DO NOT CLOSE`
  - the device is in a blocked, incident, or rollback posture
  - closing the wave record would hide an active problem

## Required closeout artifact

The closeout evaluator currently requires:

- all core evidence tracker artifacts
- `Rollout decision summary`

That means a device can no longer look “done” while still missing the final decision layer.

## Recommended use

1. Capture the normal readiness, smoke, handoff, closeout, and decision exports first.
2. Run `Copy wave closeout readiness`.
3. If the status is `CAPTURE MORE EVIDENCE`, finish the missing artifacts first.
4. If the status is `DO NOT CLOSE`, keep the wave open and escalate or recover.
5. Use `READY FOR CLOSEOUT` or `CLOSEOUT WITH MONITORING` in the final wave record.
