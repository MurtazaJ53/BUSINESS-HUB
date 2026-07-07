# Mobile Local Release Prep Runner

## Purpose

Business Hub now includes a local repo-root release prep runner:

- [D:/business-hub/scripts/mobile_flutter_release_prep.ps1](D:/business-hub/scripts/mobile_flutter_release_prep.ps1)

Use it before preflight or APK packaging when you want a clean local draft for:

- next mobile version
- next build number
- release tag
- previous mobile tag comparison
- release notes
- changelog candidate
- suggested release commands

## What it does

The runner can:

- read the current mobile version from `pubspec.yaml`
- calculate the next version with:
  - `Patch`
  - `Minor`
  - `Major`
- accept an explicit target version and build number
- generate a release prep folder with:
  - prep text summary
  - prep JSON summary
  - release notes draft
  - changelog draft
  - suggested command list
- optionally update `pubspec.yaml` when `-ApplyVersion` is used

## Recommended commands

### Doctor / preview

```powershell
pwsh ./scripts/mobile_flutter_release_prep.ps1 -Doctor
```

### Standard next patch prep

```powershell
pwsh ./scripts/mobile_flutter_release_prep.ps1 -ReleaseType pilot -ReleaseChannel pilot -PilotScope limbdi-wave-1
```

### Explicit version prep

```powershell
pwsh ./scripts/mobile_flutter_release_prep.ps1 -Version 1.4.0 -BuildNumber 9 -ReleaseType pilot -ReleaseChannel pilot -PilotScope limbdi-wave-1
```

### Override previous tag baseline

```powershell
pwsh ./scripts/mobile_flutter_release_prep.ps1 -Version 1.4.0 -BuildNumber 9 -PreviousTag mobile-v1.3.7 -ReleaseType pilot -ReleaseChannel pilot -PilotScope limbdi-wave-1
```

### Apply the prepared version into pubspec

```powershell
pwsh ./scripts/mobile_flutter_release_prep.ps1 -Version 1.4.0 -BuildNumber 9 -ReleaseType pilot -ReleaseChannel pilot -PilotScope limbdi-wave-1 -ApplyVersion
```

## Output location

By default, prep artifacts are written under:

- `release-artifacts/mobile-prep/<release-tag>/`

Expected files:

- `BusinessHub-Mobile-<release-tag>.prep.txt`
- `BusinessHub-Mobile-<release-tag>.prep.json`
- `BusinessHub-Mobile-<release-tag>.release-notes.md`
- `BusinessHub-Mobile-<release-tag>.changelog.md`
- `BusinessHub-Mobile-<release-tag>.commands.txt`

## Notes

- this runner prepares the release metadata; it does not build the APK
- if mobile tags already exist, it uses the newest prior `mobile-v*` tag as the default changelog baseline
- if mobile tags do not exist yet, it falls back to current repo history and caps the displayed commit list
- the next step after prep is usually:
  - [D:/business-hub/scripts/mobile_flutter_release.ps1](D:/business-hub/scripts/mobile_flutter_release.ps1) with `-PreflightOnly`
- use `-ApplyVersion` only when you actually want to change:
  - [D:/business-hub/apps/mobile_flutter/pubspec.yaml](D:/business-hub/apps/mobile_flutter/pubspec.yaml)
