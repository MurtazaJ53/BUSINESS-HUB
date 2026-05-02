# Mobile Pilot Evidence Persistence

## Purpose

The mobile evidence tracker is now persisted in the local device SQLite layer instead of existing only in memory.

That means a pilot device can:

- restart the app
- reconnect later in the shift
- hand the phone to the next operator

without losing the tracker state for already-captured rollout exports.

## Storage approach

Business Hub reuses the existing local key-value workspace table instead of adding a separate device-only storage path.

Relevant files:

- [D:/business-hub/apps/mobile_flutter/lib/core/runtime/pilot_evidence_tracker.dart](D:/business-hub/apps/mobile_flutter/lib/core/runtime/pilot_evidence_tracker.dart)
- [D:/business-hub/apps/mobile_flutter/lib/core/runtime/pilot_evidence_tracker_store.dart](D:/business-hub/apps/mobile_flutter/lib/core/runtime/pilot_evidence_tracker_store.dart)
- [D:/business-hub/apps/mobile_flutter/lib/core/database/mobile_repository.dart](D:/business-hub/apps/mobile_flutter/lib/core/database/mobile_repository.dart)

## What persists

For each captured evidence artifact, the device stores:

- artifact id
- capture timestamp

The tracker then reconstructs:

- core completion count
- optional completion count
- latest captured artifact
- missing core artifacts
- missing optional artifacts

## Reset behavior

The tracker is still intentionally resettable from the mobile Settings screen.

That reset is now better understood as starting a fresh named evidence session.

Use reset when:

- starting a clearly new rollout session
- moving to a different pilot context
- intentionally clearing the prior wave evidence trail

Do not reset it in the middle of an active pilot handoff unless the rollout lead explicitly wants a fresh evidence session.

## Operational value

This persistence closes a real floor-use gap:

- operators no longer lose tracker progress after an app restart
- rollout leads can trust the evidence checklist on shared devices
- shift handoff is cleaner because the next operator sees what has already been copied
- session labels make it clearer whether the visible evidence belongs to the current shift or an older one
