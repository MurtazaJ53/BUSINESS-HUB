# Mobile Local Release Bundle Runner

## Purpose

Business Hub now includes a local repo-root release bundle runner:

- [D:/business-hub/scripts/mobile_flutter_release_bundle.ps1](D:/business-hub/scripts/mobile_flutter_release_bundle.ps1)

Use it after release prep, preflight, or local packaging when you want one consolidated handoff folder for the current mobile release tag.

## What it does

The runner can:

- resolve the release tag automatically or accept `-ReleaseTag`
- inspect:
  - `release-artifacts/mobile-prep/<release-tag>/`
  - `release-artifacts/mobile-local/<release-tag>/`
- classify release posture as:
  - `prep_only`
  - `preflight_only`
  - `bundle_ready`
  - `incomplete`
  - `blocked_missing_prep`
- copy the discovered prep/preflight/package files into:
  - `release-artifacts/mobile-bundles/<release-tag>/`
- generate:
  - bundle summary text
  - bundle summary JSON
  - bundle handoff markdown

## Recommended commands

### Doctor / preview

```powershell
pwsh ./scripts/mobile_flutter_release_bundle.ps1 -Doctor
```

### Standard bundle build

```powershell
pwsh ./scripts/mobile_flutter_release_bundle.ps1 -ReleaseTag mobile-v1.4.0
```

### Require a complete package

```powershell
pwsh ./scripts/mobile_flutter_release_bundle.ps1 -ReleaseTag mobile-v1.4.0 -Strict
```

## Output location

By default, bundle artifacts are written under:

- `release-artifacts/mobile-bundles/<release-tag>/`

Expected generated files:

- `BusinessHub-Mobile-<release-tag>.bundle-summary.txt`
- `BusinessHub-Mobile-<release-tag>.bundle-summary.json`
- `BusinessHub-Mobile-<release-tag>.bundle-handoff.md`

## Notes

- this runner does not build the APK
- it consolidates what already exists from:
  - [D:/business-hub/scripts/mobile_flutter_release_prep.ps1](D:/business-hub/scripts/mobile_flutter_release_prep.ps1)
  - [D:/business-hub/scripts/mobile_flutter_release.ps1](D:/business-hub/scripts/mobile_flutter_release.ps1)
- `-Strict` is useful right before real operator handoff because it fails if the APK package is still incomplete
