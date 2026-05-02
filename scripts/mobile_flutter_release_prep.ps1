[CmdletBinding()]
param(
  [string]$Version,
  [int]$BuildNumber,
  [ValidateSet('Patch', 'Minor', 'Major')]
  [string]$VersionBump = 'Patch',
  [ValidateSet('internal_beta', 'pilot', 'production')]
  [string]$ReleaseType = 'pilot',
  [string]$ReleaseChannel = 'pilot',
  [string]$PilotScope = 'pilot-unspecified',
  [string]$ArtifactRoot = 'release-artifacts\mobile-prep',
  [switch]$ApplyVersion,
  [switch]$Doctor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$appDir = Join-Path $repoRoot 'apps\mobile_flutter'
$pubspecPath = Join-Path $appDir 'pubspec.yaml'
$notesTemplatePath = Join-Path $repoRoot 'docs\mobile-release-notes-template.md'

function Get-PubspecVersionLine {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "pubspec.yaml not found: $Path"
  }

  $versionLine = Select-String -Path $Path -Pattern '^\s*version:\s*(.+)\s*$' | Select-Object -First 1
  if ($null -eq $versionLine) {
    throw "Could not find a version entry in $Path"
  }

  return [PSCustomObject]@{
    FullMatch = $versionLine.Line
    VersionValue = $versionLine.Matches[0].Groups[1].Value.Trim()
  }
}

function ConvertTo-VersionMetadata {
  param([string]$VersionValue)

  if ($VersionValue -notmatch '^(\d+)\.(\d+)\.(\d+)\+(\d+)$') {
    throw "Version '$VersionValue' is not in expected x.y.z+build format."
  }

  return [PSCustomObject]@{
    VersionValue = $VersionValue
    Major = [int]$Matches[1]
    Minor = [int]$Matches[2]
    Patch = [int]$Matches[3]
    Build = [int]$Matches[4]
    MarketingVersion = "$($Matches[1]).$($Matches[2]).$($Matches[3])"
  }
}

function Get-NextMarketingVersion {
  param(
    [pscustomobject]$CurrentMetadata,
    [string]$ExplicitVersion,
    [string]$BumpMode
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitVersion)) {
    if ($ExplicitVersion -notmatch '^\d+\.\d+\.\d+$') {
      throw "Explicit version '$ExplicitVersion' must match x.y.z."
    }
    return $ExplicitVersion
  }

  $major = $CurrentMetadata.Major
  $minor = $CurrentMetadata.Minor
  $patch = $CurrentMetadata.Patch

  switch ($BumpMode) {
    'Major' {
      $major += 1
      $minor = 0
      $patch = 0
    }
    'Minor' {
      $minor += 1
      $patch = 0
    }
    default {
      $patch += 1
    }
  }

  return "$major.$minor.$patch"
}

function Resolve-BuildNumber {
  param(
    [pscustomobject]$CurrentMetadata,
    [int]$ExplicitBuildNumber,
    [bool]$HasExplicitBuildNumber
  )

  if ($HasExplicitBuildNumber) {
    if ($ExplicitBuildNumber -lt 1) {
      throw 'Build number must be greater than 0.'
    }
    return $ExplicitBuildNumber
  }

  return ($CurrentMetadata.Build + 1)
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

function Get-ReleaseNotesDraft {
  param(
    [string]$TemplatePath,
    [string]$TargetVersion,
    [int]$TargetBuildNumber,
    [string]$CommitSha,
    [string]$ReleaseChannelLabel,
    [string]$PilotScopeLabel,
    [string]$ShortSha,
    [string]$ReleaseTypeLabel
  )

  if (-not (Test-Path $TemplatePath)) {
    throw "Release notes template not found: $TemplatePath"
  }

  $content = Get-Content -Raw -Path $TemplatePath
  $content = $content -replace '(?m)^- Version:\s*$', "- Version: $TargetVersion"
  $content = $content -replace '(?m)^- Build number:\s*$', "- Build number: $TargetBuildNumber"
  $content = $content -replace '(?m)^- Commit:\s*$', "- Commit: $CommitSha"
  $content = $content -replace '(?m)^- Release channel:\s*$', "- Release channel: $ReleaseChannelLabel"
  $content = $content -replace '(?m)^- Pilot scope:\s*$', "- Pilot scope: $PilotScopeLabel"
  $content = $content -replace '(?m)^- Short SHA:\s*$', "- Short SHA: $ShortSha"
  $content = $content -replace '(?m)^- Release date:\s*$', "- Release date: $([DateTime]::UtcNow.ToString('yyyy-MM-dd'))"
  $content = $content -replace '(?m)^- Release type:\s*$', "- Release type: $ReleaseTypeLabel"
  return $content
}

function Update-PubspecVersion {
  param(
    [string]$Path,
    [string]$ExistingVersionValue,
    [string]$NewVersionValue
  )

  $content = Get-Content -Raw -Path $Path
  $escapedExisting = [Regex]::Escape($ExistingVersionValue)
  $updated = [Regex]::Replace($content, "(?m)^(\s*version:\s*)$escapedExisting\s*$", "`$1$NewVersionValue", 1)
  if ($updated -eq $content) {
    throw "Failed to update version in $Path"
  }
  Set-Content -Path $Path -Value $updated -Encoding utf8
}

$versionLine = Get-PubspecVersionLine -Path $pubspecPath
$currentMetadata = ConvertTo-VersionMetadata -VersionValue $versionLine.VersionValue
$targetVersion = Get-NextMarketingVersion -CurrentMetadata $currentMetadata -ExplicitVersion $Version -BumpMode $VersionBump
$hasExplicitBuildNumber = $PSBoundParameters.ContainsKey('BuildNumber')
$targetBuildNumber = Resolve-BuildNumber -CurrentMetadata $currentMetadata -ExplicitBuildNumber $BuildNumber -HasExplicitBuildNumber $hasExplicitBuildNumber
$targetVersionValue = "$targetVersion+$targetBuildNumber"
$releaseTag = "mobile-v$targetVersion"
$artifactDir = Join-Path $repoRoot (Join-Path $ArtifactRoot $releaseTag)
$gitMetadata = Get-GitMetadata
$notesDraft = Get-ReleaseNotesDraft `
  -TemplatePath $notesTemplatePath `
  -TargetVersion $targetVersion `
  -TargetBuildNumber $targetBuildNumber `
  -CommitSha $gitMetadata.FullSha `
  -ReleaseChannelLabel $ReleaseChannel `
  -PilotScopeLabel $PilotScope `
  -ShortSha $gitMetadata.ShortSha `
  -ReleaseTypeLabel $ReleaseType

if ($Doctor) {
  Write-Host "Repo root: $repoRoot"
  Write-Host "Mobile app: $appDir"
  Write-Host "Current version: $($currentMetadata.VersionValue)"
  Write-Host "Target version: $targetVersionValue"
  Write-Host "Version bump mode: $VersionBump"
  Write-Host "Release tag: $releaseTag"
  Write-Host "Release type: $ReleaseType"
  Write-Host "Release channel: $ReleaseChannel"
  Write-Host "Pilot scope: $PilotScope"
  Write-Host "Git branch: $($gitMetadata.Branch)"
  Write-Host "Commit: $($gitMetadata.FullSha)"
  Write-Host "Artifact folder: $artifactDir"
  exit 0
}

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$prepTextPath = Join-Path $artifactDir "BusinessHub-Mobile-$releaseTag.prep.txt"
$prepJsonPath = Join-Path $artifactDir "BusinessHub-Mobile-$releaseTag.prep.json"
$notesDraftPath = Join-Path $artifactDir "BusinessHub-Mobile-$releaseTag.release-notes.md"
$commandsPath = Join-Path $artifactDir "BusinessHub-Mobile-$releaseTag.commands.txt"

$prepText = @(
  "Current Version: $($currentMetadata.VersionValue)",
  "Target Version: $targetVersionValue",
  "Release Tag: $releaseTag",
  "Release Type: $ReleaseType",
  "Release Channel: $ReleaseChannel",
  "Pilot Scope: $PilotScope",
  "Branch: $($gitMetadata.Branch)",
  "Commit: $($gitMetadata.FullSha)",
  "Short SHA: $($gitMetadata.ShortSha)",
  "Apply Version: $ApplyVersion",
  "Generated At (UTC): $([DateTime]::UtcNow.ToString('o'))"
) -join [Environment]::NewLine
Set-Content -Path $prepTextPath -Value $prepText -Encoding utf8

$prepJson = @{
  current_version = $currentMetadata.VersionValue
  target_version = $targetVersion
  target_build_number = $targetBuildNumber
  target_version_value = $targetVersionValue
  release_tag = $releaseTag
  release_type = $ReleaseType
  release_channel = $ReleaseChannel
  pilot_scope = $PilotScope
  branch = $gitMetadata.Branch
  commit = $gitMetadata.FullSha
  short_sha = $gitMetadata.ShortSha
  apply_version = [bool]$ApplyVersion
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 4
Set-Content -Path $prepJsonPath -Value $prepJson -Encoding utf8

Set-Content -Path $notesDraftPath -Value $notesDraft -Encoding utf8

$commandsText = @(
  "Suggested next commands",
  "",
  "1. Review draft notes:",
  "   $notesDraftPath",
  "",
  "2. Run release preflight:",
  "   pwsh ./scripts/mobile_flutter_release.ps1 -PreflightOnly -ReleaseTag $releaseTag -ReleaseChannel $ReleaseChannel -PilotScope $PilotScope",
  "",
  "3. Build local release package:",
  "   pwsh ./scripts/mobile_flutter_release.ps1 -ReleaseTag $releaseTag -ReleaseChannel $ReleaseChannel -PilotScope $PilotScope",
  "",
  "4. Create git tag after validation:",
  "   git tag $releaseTag",
  "   git push origin $releaseTag"
) -join [Environment]::NewLine
Set-Content -Path $commandsPath -Value $commandsText -Encoding utf8

if ($ApplyVersion) {
  Update-PubspecVersion -Path $pubspecPath -ExistingVersionValue $currentMetadata.VersionValue -NewVersionValue $targetVersionValue
}

Write-Host ''
Write-Host 'Business Hub mobile release prep completed successfully.' -ForegroundColor Green
Write-Host "Current version: $($currentMetadata.VersionValue)"
Write-Host "Target version: $targetVersionValue"
Write-Host "Release tag: $releaseTag"
Write-Host "Prep text: $prepTextPath"
Write-Host "Prep JSON: $prepJsonPath"
Write-Host "Notes draft: $notesDraftPath"
Write-Host "Commands: $commandsPath"
if ($ApplyVersion) {
  Write-Host "Updated pubspec: $pubspecPath"
}
