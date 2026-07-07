# Mobile Local Release Handoff Runner

## Purpose

Business Hub now includes a local repo-root release handoff runner:

- [D:/business-hub/scripts/mobile_flutter_release_handoff.ps1](D:/business-hub/scripts/mobile_flutter_release_handoff.ps1)

Use it after bundle, registry, and tag-gate generation when you want one portable folder for a chosen mobile release tag.

## What it does

The runner can:

- resolve the release tag automatically or accept `-ReleaseTag`
- inspect:
  - `release-artifacts/mobile-bundles/<release-tag>/`
  - `release-artifacts/mobile-tags/<release-tag>/`
  - `release-artifacts/mobile-release-registry.json`
- classify the handoff posture as:
  - `handoff_ready`
  - `handoff_partial`
  - `handoff_blocked`
- copy the discovered sections into:
  - `release-artifacts/mobile-handoffs/<release-tag>/`
- generate:
  - handoff summary text
  - handoff summary JSON
  - handoff readme markdown
- optionally zip the final handoff folder

## Recommended commands

### Doctor / preview

```powershell
pwsh ./scripts/mobile_flutter_release_handoff.ps1 -Doctor -ReleaseTag mobile-v1.4.0
```

### Standard handoff build

```powershell
pwsh ./scripts/mobile_flutter_release_handoff.ps1 -ReleaseTag mobile-v1.4.0
```

### Require a fully ready handoff

```powershell
pwsh ./scripts/mobile_flutter_release_handoff.ps1 -ReleaseTag mobile-v1.4.0 -Strict
```

### Build and zip the handoff pack

```powershell
pwsh ./scripts/mobile_flutter_release_handoff.ps1 -ReleaseTag mobile-v1.4.0 -Zip
```

## Output location

By default, handoff artifacts are written under:

- `release-artifacts/mobile-handoffs/<release-tag>/`

Expected generated files:

- `BusinessHub-Mobile-<release-tag>.handoff-summary.txt`
- `BusinessHub-Mobile-<release-tag>.handoff-summary.json`
- `BusinessHub-Mobile-<release-tag>.handoff-readme.md`

Copied sections:

- `bundle/`
- `tag/`
- `registry/`

Optional zip output:

- `release-artifacts/mobile-handoffs/BusinessHub-Mobile-<release-tag>.handoff.zip`

## Notes

- this runner does not build the APK
- it is best used after:
  - [D:/business-hub/scripts/mobile_flutter_release_bundle.ps1](D:/business-hub/scripts/mobile_flutter_release_bundle.ps1)
  - [D:/business-hub/scripts/mobile_flutter_release_registry.ps1](D:/business-hub/scripts/mobile_flutter_release_registry.ps1)
  - [D:/business-hub/scripts/mobile_flutter_release_tag.ps1](D:/business-hub/scripts/mobile_flutter_release_tag.ps1)
- `-Strict` is useful right before operator archive handoff because it fails when the pack is still partial or blocked
