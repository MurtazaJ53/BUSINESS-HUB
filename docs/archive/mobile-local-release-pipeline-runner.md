# Mobile Local Release Pipeline Runner

## Purpose

Business Hub now includes a local repo-root pipeline runner:

- [D:/business-hub/scripts/mobile_flutter_release_pipeline.ps1](D:/business-hub/scripts/mobile_flutter_release_pipeline.ps1)

Use it when you want one command to drive the full local mobile release lane instead of running prep, preflight, package, bundle, registry, tag gate, and handoff separately.

## What it does

The runner orchestrates:

1. release prep
2. release preflight
3. local package build
4. release bundle
5. release registry refresh
6. release tag gate
7. release handoff pack

It writes one pipeline folder under:

- `release-artifacts/mobile-pipeline/<release-tag>/`

And produces:

- `BusinessHub-Mobile-<release-tag>.pipeline-summary.txt`
- `BusinessHub-Mobile-<release-tag>.pipeline-summary.json`
- `BusinessHub-Mobile-<release-tag>.pipeline-commands.txt`

## Verdicts

The final pipeline verdict is one of:

- `pipeline_ready`
- `pipeline_partial`
- `pipeline_blocked`

## Recommended commands

### Doctor / structure check

```powershell
pwsh ./scripts/mobile_flutter_release_pipeline.ps1 -Doctor -ReleaseTag mobile-v1.4.0
```

### Run against an existing prepared tag

```powershell
pwsh ./scripts/mobile_flutter_release_pipeline.ps1 -ReleaseTag mobile-v1.4.0 -SkipPrep -ReleaseChannel pilot -PilotScope limbdi-wave-1
```

### Run the full lane and zip the handoff

```powershell
pwsh ./scripts/mobile_flutter_release_pipeline.ps1 -Version 1.4.0 -BuildNumber 9 -ReleaseType pilot -ReleaseChannel pilot -PilotScope limbdi-wave-1 -ZipHandoff
```

### Allow a prep-only tag gate posture when you are intentionally staging early

```powershell
pwsh ./scripts/mobile_flutter_release_pipeline.ps1 -ReleaseTag mobile-v1.4.0 -SkipPrep -AllowPrepOnlyTag
```

## Notes

- this runner does not hide environment problems
- if Flutter is missing or signing is not configured, the pipeline summary will still complete and record that blocked posture
- the main value is one final summary folder and one final verdict for the whole local release lane
