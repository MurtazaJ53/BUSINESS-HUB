# Mobile Local Release Tag Runner

## Purpose

Business Hub now includes a local repo-root release tag runner:

- [D:/business-hub/scripts/mobile_flutter_release_tag.ps1](D:/business-hub/scripts/mobile_flutter_release_tag.ps1)

Use it when you want one controlled tag gate instead of creating `mobile-v*` tags manually.

## What it does

The runner can:

- read the current release posture from:
  - [D:/business-hub/release-artifacts/mobile-release-registry.json](D:/business-hub/release-artifacts/mobile-release-registry.json)
- resolve or accept a release tag
- check whether the tag already exists
- classify the tag gate as:
  - `ready_to_tag`
  - `ready_to_tag_with_prep_only_override`
  - `tag_exists`
  - `missing_registry_entry`
  - `blocked`
- generate a local tag summary and command draft
- optionally create and push the annotated git tag when explicitly requested

## Recommended commands

### Doctor / preview

```powershell
pwsh ./scripts/mobile_flutter_release_tag.ps1 -Doctor -ReleaseTag mobile-v1.4.0
```

### Build tag gate summary only

```powershell
pwsh ./scripts/mobile_flutter_release_tag.ps1 -ReleaseTag mobile-v1.4.0
```

### Allow prep-only override

```powershell
pwsh ./scripts/mobile_flutter_release_tag.ps1 -ReleaseTag mobile-v1.4.0 -AllowPrepOnly
```

### Create the annotated git tag

```powershell
pwsh ./scripts/mobile_flutter_release_tag.ps1 -ReleaseTag mobile-v1.4.0 -CreateTag
```

### Create and push the git tag

```powershell
pwsh ./scripts/mobile_flutter_release_tag.ps1 -ReleaseTag mobile-v1.4.0 -CreateTag -PushTag
```

## Output location

By default, tag artifacts are written under:

- `release-artifacts/mobile-tags/<release-tag>/`

Expected generated files:

- `BusinessHub-Mobile-<release-tag>.tag-summary.txt`
- `BusinessHub-Mobile-<release-tag>.tag-summary.json`
- `BusinessHub-Mobile-<release-tag>.tag-commands.txt`

## Notes

- the runner does not build or bundle the release itself
- it is best used after:
  - [D:/business-hub/scripts/mobile_flutter_release_prep.ps1](D:/business-hub/scripts/mobile_flutter_release_prep.ps1)
  - [D:/business-hub/scripts/mobile_flutter_release.ps1](D:/business-hub/scripts/mobile_flutter_release.ps1)
  - [D:/business-hub/scripts/mobile_flutter_release_bundle.ps1](D:/business-hub/scripts/mobile_flutter_release_bundle.ps1)
  - [D:/business-hub/scripts/mobile_flutter_release_registry.ps1](D:/business-hub/scripts/mobile_flutter_release_registry.ps1)
- `-CreateTag` and `-PushTag` are intentionally explicit so preview mode stays safe
