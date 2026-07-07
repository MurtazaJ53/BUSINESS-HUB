# Mobile Pilot Evidence Session History

## Purpose

The mobile evidence tracker now keeps a short archive of recent completed sessions when a fresh session is started.

This matters on shared rollout devices because:

- the next operator may need to confirm what happened in the previous shift
- the rollout lead may want the last completed session summary without reopening older chat threads
- starting a fresh session should not destroy the last session context completely

## What gets archived

When a fresh session starts, the previous session is summarized and archived with:

- session label
- session started time
- session closed time
- core completion counts
- optional completion counts
- latest captured artifact
- session status label

## In-app behavior

The Settings screen now shows:

- archived session count
- recent archived session summaries
- a `Copy latest archived session` action
- a `Copy full archive pack` action
- a `Clear archived sessions` action

This gives the rollout lead a fast way to recover the previous session summary even after the device has moved on to a new active session.

## Retention

The mobile archive is intentionally short and device-local.

It is meant for recent pilot continuity, not as a permanent audit database.

## Recommended use

Use archived session history when:

- the next shift wants to verify whether the prior shift finished cleanly
- the rollout lead wants the last completed session summary
- support needs context from the immediately previous rollout window

## Related

- [D:/business-hub/docs/mobile-pilot-evidence-archive-control.md](D:/business-hub/docs/mobile-pilot-evidence-archive-control.md)
