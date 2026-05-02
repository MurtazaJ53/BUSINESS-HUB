# Mobile Local Release Runner

## Purpose

Business Hub now includes a local repo-root release runner:

- [D:/business-hub/scripts/mobile_flutter_release.ps1](D:/business-hub/scripts/mobile_flutter_release.ps1)

Use it when you want to build a local pilot APK package outside GitHub Actions and still produce the expected release artifacts.

## What it does

The runner can:

- resolve Flutter from:
  - `-FlutterRoot`
  - `BUSINESS_HUB_FLUTTER_HOME`
  - `FLUTTER_HOME`
  - common local install paths
  - existing `flutter` commands if available
- read version/build from `pubspec.yaml`
- inject release metadata:
  - release tag
  - release channel
  - pilot scope
  - short SHA
- run:
  - `flutter pub get`
  - code generation
  - `flutter analyze`
  - `flutter test`
  - `flutter build apk --release`
- publish a local release folder with:
  - APK
  - `.sha256`
  - manifest text
  - manifest JSON
  - handoff markdown

Doctor mode also reports:

- resolved Flutter/Dart paths
- version + build number
- release tag/channel/pilot scope
- commit + short SHA
- signing mode and signing source
- intended artifact folder

## Recommended commands

### Doctor / environment check

```powershell
pwsh ./scripts/mobile_flutter_release.ps1 -Doctor
```

### Standard local pilot release

```powershell
pwsh ./scripts/mobile_flutter_release.ps1 -ReleaseTag mobile-v1.4.0 -ReleaseChannel pilot -PilotScope limbdi-wave-1
```

### Explicit Flutter SDK path

```powershell
pwsh ./scripts/mobile_flutter_release.ps1 -FlutterRoot C:\path\to\flutter -ReleaseTag mobile-v1.4.0 -ReleaseChannel pilot -PilotScope limbdi-wave-1
```

## Output location

By default, local release artifacts are written under:

- `release-artifacts/mobile-local/<release-tag>/`

Expected files:

- `BusinessHub-Mobile-<release-tag>.apk`
- `BusinessHub-Mobile-<release-tag>.apk.sha256`
- `BusinessHub-Mobile-<release-tag>.manifest.txt`
- `BusinessHub-Mobile-<release-tag>.manifest.json`
- `BusinessHub-Mobile-<release-tag>.handoff.md`

## Notes

- local signing readiness depends on:
  - Android signing env vars, or
  - [D:/business-hub/apps/mobile_flutter/android/key.properties](D:/business-hub/apps/mobile_flutter/android/key.properties)
- if signing is not configured, the script still allows the build lane to continue and records `fallback_debug` in the manifest/handoff output
- if Flutter is missing, `-Doctor` fails cleanly and tells you how to fix resolution
