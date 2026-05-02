[CmdletBinding()]
param(
  [string]$FlutterRoot,
  [string]$Version,
  [int]$BuildNumber,
  [string]$PreviousTag,
  [int]$MaxCommitItems = 50,
  [ValidateSet('Patch', 'Minor', 'Major')]
  [string]$VersionBump = 'Patch',
  [ValidateSet('internal_beta', 'pilot', 'production')]
  [string]$ReleaseType = 'pilot',
  [string]$ReleaseChannel = 'pilot',
  [string]$PilotScope = 'pilot-unspecified',
  [string]$ReleaseTag,
  [switch]$ApplyVersion,
  [switch]$SkipPrep,
  [switch]$AllowPrepOnlyTag,
  [switch]$ZipHandoff,
  [switch]$StrictHandoff,
  [switch]$Doctor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$prepScript = Join-Path $PSScriptRoot 'mobile_flutter_release_prep.ps1'
$releaseScript = Join-Path $PSScriptRoot 'mobile_flutter_release.ps1'
$bundleScript = Join-Path $PSScriptRoot 'mobile_flutter_release_bundle.ps1'
$registryScript = Join-Path $PSScriptRoot 'mobile_flutter_release_registry.ps1'
$tagScript = Join-Path $PSScriptRoot 'mobile_flutter_release_tag.ps1'
$handoffScript = Join-Path $PSScriptRoot 'mobile_flutter_release_handoff.ps1'
$pipelineRoot = Join-Path $repoRoot 'release-artifacts\mobile-pipeline'

function Test-ScriptSet {
  param([string[]]$Paths)

  foreach ($path in $Paths) {
    if (-not (Test-Path $path)) {
      throw "Required script not found: $path"
    }
  }
}

function Get-ChildPowerShellExecutable {
  foreach ($commandName in @('pwsh', 'powershell')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
      return $command.Source
    }
  }

  throw 'Could not resolve pwsh or powershell for child script execution.'
}

function Get-GitMetadata {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($null -eq $git) {
    return [PSCustomObject]@{
      FullSha = 'nogit'
      ShortSha = 'nogit'
      Branch = 'nogit'
    }
  }

  $fullSha = & $git.Source rev-parse HEAD 2>$null
  $branch = & $git.Source branch --show-current 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($fullSha)) {
    return [PSCustomObject]@{
      FullSha = 'nogit'
      ShortSha = 'nogit'
      Branch = 'nogit'
    }
  }

  $fullSha = $fullSha.Trim()
  $shortSha = if ($fullSha.Length -ge 7) { $fullSha.Substring(0, 7) } else { $fullSha }
  $branch = if ([string]::IsNullOrWhiteSpace($branch)) { 'unknown' } else { $branch.Trim() }
  return [PSCustomObject]@{
    FullSha = $fullSha
    ShortSha = $shortSha
    Branch = $branch
  }
}

function ConvertTo-ArgumentList {
  param([hashtable]$Parameters)

  $args = New-Object System.Collections.Generic.List[string]
  foreach ($entry in $Parameters.GetEnumerator()) {
    if ($entry.Value -is [System.Management.Automation.SwitchParameter]) {
      if ($entry.Value.IsPresent) {
        $args.Add("-$($entry.Key)")
      }
      continue
    }

    if ($entry.Value -is [bool]) {
      if ($entry.Value) {
        $args.Add("-$($entry.Key)")
      }
      continue
    }

    if ($null -eq $entry.Value) {
      continue
    }

    $valueString = [string]$entry.Value
    if ([string]::IsNullOrWhiteSpace($valueString)) {
      continue
    }

    $args.Add("-$($entry.Key)")
    $args.Add($valueString)
  }
  return @($args)
}

function Invoke-ReleaseStep {
  param(
    [string]$Name,
    [string]$ScriptPath,
    [hashtable]$Parameters,
    [string]$SummaryPath
  )

  $args = ConvertTo-ArgumentList -Parameters $Parameters
  $childShell = Get-ChildPowerShellExecutable
  $childArgs = @('-ExecutionPolicy', 'Bypass', '-File', $ScriptPath) + $args
  $commandText = "$childShell " + ($childArgs -join ' ')
  $stepStart = [DateTime]::UtcNow
  $outputLines = New-Object System.Collections.Generic.List[string]
  $success = $true
  $exitCode = 0
  $failureMessage = $null

  Write-Host ''
  Write-Host "==> $Name" -ForegroundColor Cyan
  Write-Host $commandText -ForegroundColor DarkGray

  try {
    $captured = & $childShell @childArgs 2>&1
    $exitCode = $LASTEXITCODE
    if ($null -ne $captured) {
      foreach ($line in @($captured)) {
        $text = [string]$line
        $outputLines.Add($text)
        Write-Host $text
      }
    }
    if ($exitCode -ne 0) {
      $success = $false
      $failureMessage = "Step exited with code $exitCode."
    }
  } catch {
    $success = $false
    $exitCode = if ($LASTEXITCODE -ne $null) { [int]$LASTEXITCODE } else { 1 }
    $failureMessage = $_.Exception.Message
    $outputLines.Add("ERROR: $failureMessage")
    Write-Host "ERROR: $failureMessage" -ForegroundColor Yellow
  }

  $stepEnd = [DateTime]::UtcNow
  $summaryObject = [ordered]@{
    name = $Name
    script = $ScriptPath
    command = $commandText.Trim()
    success = $success
    exit_code = $exitCode
    started_at_utc = $stepStart.ToString('o')
    completed_at_utc = $stepEnd.ToString('o')
    duration_seconds = [Math]::Round(($stepEnd - $stepStart).TotalSeconds, 2)
    failure_message = $failureMessage
    output = @($outputLines)
  }

  $summaryObject | ConvertTo-Json -Depth 5 | Set-Content -Path $SummaryPath -Encoding utf8
  return [PSCustomObject]$summaryObject
}

function Resolve-ReleaseTagFromPrep {
  param(
    [string]$ExplicitReleaseTag,
    [string]$PipelineDirectory
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitReleaseTag)) {
    return $ExplicitReleaseTag.Trim()
  }

  $prepStepPath = Join-Path $PipelineDirectory '01-prep.json'
  if (-not (Test-Path $prepStepPath)) {
    throw 'Could not resolve release tag because the prep step summary is missing.'
  }

  $prepStep = Get-Content -Raw -Path $prepStepPath | ConvertFrom-Json
  foreach ($line in @($prepStep.output)) {
    if ($line -match '^Release tag:\s*(.+)\s*$') {
      return $Matches[1].Trim()
    }
  }

  throw 'Could not resolve release tag from prep output.'
}

function Get-HandoffVerdictFromSummary {
  param([string]$PipelineDirectory)

  $handoffSummaryPath = Join-Path $PipelineDirectory '07-handoff.json'
  if (-not (Test-Path $handoffSummaryPath)) {
    return 'missing'
  }

  $handoffStep = Get-Content -Raw -Path $handoffSummaryPath | ConvertFrom-Json
  foreach ($line in @($handoffStep.output)) {
    if ($line -match '^Handoff verdict:\s*(.+)\s*$') {
      return $Matches[1].Trim()
    }
  }

  return if ($handoffStep.success) { 'unknown' } else { 'missing' }
}

function Get-PipelineVerdict {
  param(
    [System.Object[]]$Steps,
    [string]$HandoffVerdict
  )

  $prepStep = $Steps | Where-Object { $_.name -eq 'prep' } | Select-Object -First 1
  $preflightStep = $Steps | Where-Object { $_.name -eq 'preflight' } | Select-Object -First 1
  $packageStep = $Steps | Where-Object { $_.name -eq 'package' } | Select-Object -First 1

  if ($null -eq $prepStep -or -not $prepStep.success) {
    return 'pipeline_blocked'
  }

  if ($HandoffVerdict -eq 'handoff_ready') {
    return 'pipeline_ready'
  }

  if (($null -ne $preflightStep -and $preflightStep.success) -or ($null -ne $packageStep -and $packageStep.success)) {
    return 'pipeline_partial'
  }

  return 'pipeline_blocked'
}

Test-ScriptSet -Paths @(
  $prepScript,
  $releaseScript,
  $bundleScript,
  $registryScript,
  $tagScript,
  $handoffScript
)

$gitMetadata = Get-GitMetadata
$initialTag = if (-not [string]::IsNullOrWhiteSpace($ReleaseTag)) { $ReleaseTag.Trim() } else { 'pending-release-tag' }
$pipelineDir = Join-Path $pipelineRoot $initialTag

if ($Doctor) {
  Write-Host "Repo root: $repoRoot"
  Write-Host "Prep script: $prepScript"
  Write-Host "Release script: $releaseScript"
  Write-Host "Bundle script: $bundleScript"
  Write-Host "Registry script: $registryScript"
  Write-Host "Tag script: $tagScript"
  Write-Host "Handoff script: $handoffScript"
  Write-Host "Initial release tag: $initialTag"
  Write-Host "Pipeline dir: $pipelineDir"
  Write-Host "Skip prep: $SkipPrep"
  Write-Host "Apply version: $ApplyVersion"
  Write-Host "Allow prep-only tag: $AllowPrepOnlyTag"
  Write-Host "Zip handoff: $ZipHandoff"
  Write-Host "Strict handoff: $StrictHandoff"
  Write-Host "Git branch: $($gitMetadata.Branch)"
  Write-Host "Commit: $($gitMetadata.FullSha)"
  exit 0
}

New-Item -ItemType Directory -Force -Path $pipelineDir | Out-Null

$steps = New-Object System.Collections.Generic.List[object]

if (-not $SkipPrep) {
  $prepParams = @{
    Version = $Version
    BuildNumber = if ($PSBoundParameters.ContainsKey('BuildNumber')) { $BuildNumber } else { $null }
    PreviousTag = $PreviousTag
    MaxCommitItems = $MaxCommitItems
    VersionBump = $VersionBump
    ReleaseType = $ReleaseType
    ReleaseChannel = $ReleaseChannel
    PilotScope = $PilotScope
    ApplyVersion = $ApplyVersion
  }

  $prepStep = Invoke-ReleaseStep `
    -Name 'prep' `
    -ScriptPath $prepScript `
    -Parameters $prepParams `
    -SummaryPath (Join-Path $pipelineDir '01-prep.json')
  $steps.Add($prepStep) | Out-Null
} else {
  $skipSummary = [ordered]@{
    name = 'prep'
    script = $prepScript
    command = 'skipped'
    success = $true
    exit_code = 0
    started_at_utc = [DateTime]::UtcNow.ToString('o')
    completed_at_utc = [DateTime]::UtcNow.ToString('o')
    duration_seconds = 0
    failure_message = $null
    output = @('Prep step skipped by request.')
  }
  $skipSummary | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $pipelineDir '01-prep.json') -Encoding utf8
  $steps.Add([PSCustomObject]$skipSummary) | Out-Null
}

$resolvedReleaseTag = Resolve-ReleaseTagFromPrep -ExplicitReleaseTag $ReleaseTag -PipelineDirectory $pipelineDir
if ($initialTag -ne $resolvedReleaseTag) {
  $newPipelineDir = Join-Path $pipelineRoot $resolvedReleaseTag
  if ($pipelineDir -ne $newPipelineDir) {
    if (Test-Path $newPipelineDir) {
      Remove-Item -Recurse -Force -Path $newPipelineDir
    }
    Move-Item -Path $pipelineDir -Destination $newPipelineDir
    $pipelineDir = $newPipelineDir
  }
}

$preflightParams = @{
  FlutterRoot = $FlutterRoot
  ReleaseTag = $resolvedReleaseTag
  ReleaseChannel = $ReleaseChannel
  PilotScope = $PilotScope
  PreflightOnly = $true
}
$preflightStep = Invoke-ReleaseStep `
  -Name 'preflight' `
  -ScriptPath $releaseScript `
  -Parameters $preflightParams `
  -SummaryPath (Join-Path $pipelineDir '02-preflight.json')
$steps.Add($preflightStep) | Out-Null

$packageParams = @{
  FlutterRoot = $FlutterRoot
  ReleaseTag = $resolvedReleaseTag
  ReleaseChannel = $ReleaseChannel
  PilotScope = $PilotScope
}
$packageStep = Invoke-ReleaseStep `
  -Name 'package' `
  -ScriptPath $releaseScript `
  -Parameters $packageParams `
  -SummaryPath (Join-Path $pipelineDir '03-package.json')
$steps.Add($packageStep) | Out-Null

$bundleParams = @{
  ReleaseTag = $resolvedReleaseTag
}
$bundleStep = Invoke-ReleaseStep `
  -Name 'bundle' `
  -ScriptPath $bundleScript `
  -Parameters $bundleParams `
  -SummaryPath (Join-Path $pipelineDir '04-bundle.json')
$steps.Add($bundleStep) | Out-Null

$registryStep = Invoke-ReleaseStep `
  -Name 'registry' `
  -ScriptPath $registryScript `
  -Parameters @{} `
  -SummaryPath (Join-Path $pipelineDir '05-registry.json')
$steps.Add($registryStep) | Out-Null

$tagParams = @{
  ReleaseTag = $resolvedReleaseTag
  AllowPrepOnly = $AllowPrepOnlyTag
}
$tagStep = Invoke-ReleaseStep `
  -Name 'tag' `
  -ScriptPath $tagScript `
  -Parameters $tagParams `
  -SummaryPath (Join-Path $pipelineDir '06-tag.json')
$steps.Add($tagStep) | Out-Null

$handoffParams = @{
  ReleaseTag = $resolvedReleaseTag
  Zip = $ZipHandoff
  Strict = $StrictHandoff
}
$handoffStep = Invoke-ReleaseStep `
  -Name 'handoff' `
  -ScriptPath $handoffScript `
  -Parameters $handoffParams `
  -SummaryPath (Join-Path $pipelineDir '07-handoff.json')
$steps.Add($handoffStep) | Out-Null

$stepsArray = $steps.ToArray()
$handoffVerdict = Get-HandoffVerdictFromSummary -PipelineDirectory $pipelineDir
$pipelineVerdict = Get-PipelineVerdict -Steps $stepsArray -HandoffVerdict $handoffVerdict
$summaryTextPath = Join-Path $pipelineDir "BusinessHub-Mobile-$resolvedReleaseTag.pipeline-summary.txt"
$summaryJsonPath = Join-Path $pipelineDir "BusinessHub-Mobile-$resolvedReleaseTag.pipeline-summary.json"
$commandsPath = Join-Path $pipelineDir "BusinessHub-Mobile-$resolvedReleaseTag.pipeline-commands.txt"

$stepLines = @(
  $stepsArray | ForEach-Object {
    "$($_.name): success=$($_.success) exit=$($_.exit_code)"
  }
)

$summaryLines = New-Object System.Collections.Generic.List[string]
$summaryLines.Add("Release Tag: $resolvedReleaseTag")
$summaryLines.Add("Pipeline Verdict: $pipelineVerdict")
$summaryLines.Add("Handoff Verdict: $handoffVerdict")
$summaryLines.Add("Git Branch: $($gitMetadata.Branch)")
$summaryLines.Add("Commit: $($gitMetadata.FullSha)")
$summaryLines.Add("Pipeline Directory: $pipelineDir")
$summaryLines.Add('Steps:')
foreach ($line in $stepLines) {
  $summaryLines.Add($line)
}
$summaryLines.Add("Generated At (UTC): $([DateTime]::UtcNow.ToString('o'))")
$summaryText = $summaryLines -join [Environment]::NewLine
Set-Content -Path $summaryTextPath -Value $summaryText -Encoding utf8

$summaryJson = @{
  release_tag = $resolvedReleaseTag
  pipeline_verdict = $pipelineVerdict
  handoff_verdict = $handoffVerdict
  git_branch = $gitMetadata.Branch
  commit = $gitMetadata.FullSha
  short_sha = $gitMetadata.ShortSha
  pipeline_directory = $pipelineDir
  skip_prep = [bool]$SkipPrep
  apply_version = [bool]$ApplyVersion
  allow_prep_only_tag = [bool]$AllowPrepOnlyTag
  zip_handoff = [bool]$ZipHandoff
  strict_handoff = [bool]$StrictHandoff
  steps = $stepsArray
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 8
Set-Content -Path $summaryJsonPath -Value $summaryJson -Encoding utf8

$commandsText = @(
  "Suggested next commands",
  "",
  "1. Inspect pipeline summary:",
  "   $summaryTextPath",
  "",
  "2. If Flutter or signing was blocked, rerun preflight:",
  "   pwsh ./scripts/mobile_flutter_release.ps1 -PreflightOnly -ReleaseTag $resolvedReleaseTag -ReleaseChannel $ReleaseChannel -PilotScope $PilotScope",
  "",
  "3. Rebuild package after environment recovery:",
  "   pwsh ./scripts/mobile_flutter_release.ps1 -ReleaseTag $resolvedReleaseTag -ReleaseChannel $ReleaseChannel -PilotScope $PilotScope",
  "",
  "4. Refresh downstream artifacts:",
  "   pwsh ./scripts/mobile_flutter_release_bundle.ps1 -ReleaseTag $resolvedReleaseTag",
  "   pwsh ./scripts/mobile_flutter_release_registry.ps1",
  "   pwsh ./scripts/mobile_flutter_release_tag.ps1 -ReleaseTag $resolvedReleaseTag",
  "   pwsh ./scripts/mobile_flutter_release_handoff.ps1 -ReleaseTag $resolvedReleaseTag",
  "",
  "5. Or rerun the full pipeline:",
  "   pwsh ./scripts/mobile_flutter_release_pipeline.ps1 -ReleaseTag $resolvedReleaseTag -SkipPrep -ReleaseChannel $ReleaseChannel -PilotScope $PilotScope"
) -join [Environment]::NewLine
Set-Content -Path $commandsPath -Value $commandsText -Encoding utf8

Write-Host ''
Write-Host 'Business Hub mobile release pipeline completed.' -ForegroundColor Green
Write-Host "Release tag: $resolvedReleaseTag"
Write-Host "Pipeline verdict: $pipelineVerdict"
Write-Host "Handoff verdict: $handoffVerdict"
Write-Host "Pipeline dir: $pipelineDir"
Write-Host "Summary text: $summaryTextPath"
Write-Host "Summary JSON: $summaryJsonPath"
Write-Host "Commands: $commandsPath"
