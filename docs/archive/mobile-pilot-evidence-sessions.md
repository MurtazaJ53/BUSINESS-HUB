# Mobile Pilot Evidence Sessions

## Purpose

The mobile evidence tracker now carries a real session context, not just a list of copied artifacts.

This helps with a common rollout problem on shared devices:

- the app restarts
- the tracker still has old captured evidence
- the next operator cannot tell whether that evidence belongs to the current shift or an older wave

## What a session adds

Each tracker state can now carry:

- session label
- session started timestamp
- last reset timestamp

That means the rollout lead can see not only what was copied, but also which named rollout session the tracker belongs to.

## Suggested session labels

Good examples:

- `Bhavnagar Wave 1 | Morning Shift | 2026-05-02`
- `Retail Pilot | Wave 2 | Owner Device | 2026-05-03`
- `Shop 17 | Handover Shift | mobile-v1.3.8 | 2026-05-05`

The goal is to make it obvious:

- which shop
- which wave or shift
- which release context
- which day

## In-app behavior

The Settings screen now:

- auto-initializes a default session label when needed
- shows the current evidence session
- shows when that session started
- lets the operator start a fresh session with a new label

Starting a fresh session:

- clears the captured evidence list
- stamps a new session start
- preserves a clear operational boundary between shifts or rollout waves
- archives the previous session summary so the last rollout window is not lost immediately

## Recommended use

Start a fresh session when:

- a new rollout wave begins
- a new operator shift begins and the lead wants a fresh evidence trail
- a device is reassigned to a different pilot context

Avoid starting a fresh session in the middle of an active validation run unless the rollout lead explicitly wants to discard the earlier capture trail.

## Related

- [D:/business-hub/docs/mobile-pilot-evidence-session-history.md](D:/business-hub/docs/mobile-pilot-evidence-session-history.md)
