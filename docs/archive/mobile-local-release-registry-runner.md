# Mobile Local Release Registry Runner

## Purpose

Business Hub now includes a local repo-root release registry runner:

- [D:/business-hub/scripts/mobile_flutter_release_registry.ps1](D:/business-hub/scripts/mobile_flutter_release_registry.ps1)

Use it when you want one index across all discovered mobile release tags and artifact states.

## What it does

The runner scans:

- `release-artifacts/mobile-prep/`
- `release-artifacts/mobile-local/`
- `release-artifacts/mobile-bundles/`
- `git tag --list "mobile-v*"`

It then writes:

- `release-artifacts/mobile-release-registry.json`
- `release-artifacts/mobile-release-registry.md`

Each discovered release tag is classified with:

- prep status
- preflight status
- package status
- bundle status
- overall verdict

## Recommended commands

### Doctor / preview

```powershell
pwsh ./scripts/mobile_flutter_release_registry.ps1 -Doctor
```

### Build the registry

```powershell
pwsh ./scripts/mobile_flutter_release_registry.ps1
```

## Notes

- this runner does not modify a release tag or build artifacts
- it is best used after:
  - [D:/business-hub/scripts/mobile_flutter_release_prep.ps1](D:/business-hub/scripts/mobile_flutter_release_prep.ps1)
  - [D:/business-hub/scripts/mobile_flutter_release.ps1](D:/business-hub/scripts/mobile_flutter_release.ps1)
  - [D:/business-hub/scripts/mobile_flutter_release_bundle.ps1](D:/business-hub/scripts/mobile_flutter_release_bundle.ps1)
- it gives release and operations one current source of truth for all local mobile release states
