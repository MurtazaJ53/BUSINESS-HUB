# Mobile Local Validation Runner

## Purpose

Business Hub now includes a local PowerShell runner for Flutter validation:

- [D:/business-hub/scripts/mobile_flutter_validate.ps1](D:/business-hub/scripts/mobile_flutter_validate.ps1)

Use it when:

- `flutter` is not on PATH
- you want one repeatable local command instead of remembering several manual steps
- you want a release or debug validation lane from the repo root

## What it does

The runner can:

- resolve Flutter from:
  - `-FlutterRoot`
  - `BUSINESS_HUB_FLUTTER_HOME`
  - `FLUTTER_HOME`
  - common local install paths
  - existing `flutter` / `flutter.bat` commands if available
- run:
  - `flutter pub get`
  - code generation
  - `flutter analyze`
  - `flutter test`
  - `flutter build apk`

## Recommended commands

### Doctor / path check

```powershell
pwsh ./scripts/mobile_flutter_validate.ps1 -Doctor
```

### Standard local validation

```powershell
pwsh ./scripts/mobile_flutter_validate.ps1 -BuildMode Debug
```

### Release-oriented validation

```powershell
pwsh ./scripts/mobile_flutter_validate.ps1 -BuildMode Release
```

### Explicit Flutter SDK path

```powershell
pwsh ./scripts/mobile_flutter_validate.ps1 -FlutterRoot C:\path\to\flutter -BuildMode Release
```

## Useful switches

- `-SkipPubGet`
- `-SkipCodegen`
- `-SkipAnalyze`
- `-SkipTest`
- `-SkipBuild`
- `-BuildMode None`

## Recommended use

1. Run `-Doctor` first if Flutter is not on PATH.
2. Use `-FlutterRoot` or `BUSINESS_HUB_FLUTTER_HOME` on machines without a global install.
3. Use `-BuildMode Debug` for normal daily validation.
4. Use `-BuildMode Release` before pilot APK handoff work.
