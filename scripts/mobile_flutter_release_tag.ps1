[CmdletBinding()]
param(
  [string]$ReleaseTag,
  [string]$RegistryPath = 'release-artifacts\mobile-release-registry.json',
  [string]$OutputRoot = 'release-artifacts\mobile-tags',
  [switch]$CreateTag,
  [switch]$PushTag,
  [switch]$AllowPrepOnly,
  [switch]$Doctor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Get-GitMetadata {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($null -eq $git) {
    return [PSCustomObject]@{
      GitPath = $null
      FullSha = 'nogit'
      ShortSha = 'nogit'
      Branch = 'nogit'
    }
  }

  $fullSha = & $git.Source rev-parse HEAD 2>$null
  $branch = & $git.Source branch --show-current 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($fullSha)) {
    return [PSCustomObject]@{
      GitPath = $git.Source
      FullSha = 'nogit'
      ShortSha = 'nogit'
      Branch = 'nogit'
    }
  }

  $fullSha = $fullSha.Trim()
  $shortSha = if ($fullSha.Length -ge 7) { $fullSha.Substring(0, 7) } else { $fullSha }
  $branch = if ([string]::IsNullOrWhiteSpace($branch)) { 'unknown' } else { $branch.Trim() }
  return [PSCustomObject]@{
    GitPath = $git.Source
    FullSha = $fullSha
    ShortSha = $shortSha
    Branch = $branch
  }
}

function Get-MobileReleaseTags {
  param([string]$GitPath)

  if ([string]::IsNullOrWhiteSpace($GitPath)) {
    return @()
  }

  $tags = & $GitPath tag --list 'mobile-v*' --sort=-version:refname 2>$null
  if ($LASTEXITCODE -ne 0 -or $null -eq $tags) {
    return @()
  }

  return @($tags | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim() })
}

function Resolve-ReleaseTag {
  param(
    [string]$ExplicitReleaseTag,
    [object]$RegistryData,
    [string[]]$ExistingTags
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitReleaseTag)) {
    return $ExplicitReleaseTag.Trim()
  }

  if ($null -ne $RegistryData -and $null -ne $RegistryData.releases) {
    $first = @($RegistryData.releases)[0]
    if ($null -ne $first -and -not [string]::IsNullOrWhiteSpace($first.tag)) {
      return [string]$first.tag
    }
  }

  if ($ExistingTags.Count -gt 0) {
    return $ExistingTags[0]
  }

  throw 'Could not resolve a release tag. Pass -ReleaseTag explicitly.'
}

function Get-RegistryData {
  param([string]$RegistryFilePath)

  if (-not (Test-Path $RegistryFilePath)) {
    return $null
  }

  $content = Get-Content -Raw -Path $RegistryFilePath
  if ([string]::IsNullOrWhiteSpace($content)) {
    return $null
  }

  return $content | ConvertFrom-Json
}

function Get-ReleaseEntryFromRegistry {
  param(
    [object]$RegistryData,
    [string]$Tag
  )

  if ($null -eq $RegistryData -or $null -eq $RegistryData.releases) {
    return $null
  }

  foreach ($entry in @($RegistryData.releases)) {
    if ($entry.tag -eq $Tag) {
      return $entry
    }
  }

  return $null
}

function Get-TagGateVerdict {
  param(
    [object]$ReleaseEntry,
    [bool]$TagExists,
    [bool]$AllowPrepOnlyMode
  )

  if ($TagExists) {
    return 'tag_exists'
  }

  if ($null -eq $ReleaseEntry) {
    return 'missing_registry_entry'
  }

  if ($ReleaseEntry.overall_verdict -eq 'bundle_ready') {
    return 'ready_to_tag'
  }

  if ($AllowPrepOnlyMode -and $ReleaseEntry.overall_verdict -eq 'prep_only') {
    return 'ready_to_tag_with_prep_only_override'
  }

  return 'blocked'
}

$gitMetadata = Get-GitMetadata
$registryFilePath = Join-Path $repoRoot $RegistryPath
$registryData = Get-RegistryData -RegistryFilePath $registryFilePath
$existingTags = Get-MobileReleaseTags -GitPath $gitMetadata.GitPath
$resolvedReleaseTag = Resolve-ReleaseTag -ExplicitReleaseTag $ReleaseTag -RegistryData $registryData -ExistingTags $existingTags
$tagExists = $existingTags -contains $resolvedReleaseTag
$releaseEntry = Get-ReleaseEntryFromRegistry -RegistryData $registryData -Tag $resolvedReleaseTag
$tagGateVerdict = Get-TagGateVerdict -ReleaseEntry $releaseEntry -TagExists $tagExists -AllowPrepOnlyMode ([bool]$AllowPrepOnly)
$outputDir = Join-Path $repoRoot (Join-Path $OutputRoot $resolvedReleaseTag)

if ($Doctor) {
  Write-Host "Repo root: $repoRoot"
  Write-Host "Registry: $registryFilePath"
  Write-Host "Release tag: $resolvedReleaseTag"
  Write-Host "Tag exists: $tagExists"
  Write-Host "Git branch: $($gitMetadata.Branch)"
  Write-Host "Commit: $($gitMetadata.FullSha)"
  if ($null -ne $releaseEntry) {
    Write-Host "Registry overall verdict: $($releaseEntry.overall_verdict)"
    Write-Host "Prep status: $($releaseEntry.prep_status)"
    Write-Host "Preflight status: $($releaseEntry.preflight_status)"
    Write-Host "Package status: $($releaseEntry.package_status)"
    Write-Host "Bundle status: $($releaseEntry.bundle_status)"
  } else {
    Write-Host 'Registry overall verdict: <missing>'
  }
  Write-Host "Tag gate verdict: $tagGateVerdict"
  Write-Host "Output dir: $outputDir"
  exit 0
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$summaryTextPath = Join-Path $outputDir "BusinessHub-Mobile-$resolvedReleaseTag.tag-summary.txt"
$summaryJsonPath = Join-Path $outputDir "BusinessHub-Mobile-$resolvedReleaseTag.tag-summary.json"
$commandsPath = Join-Path $outputDir "BusinessHub-Mobile-$resolvedReleaseTag.tag-commands.txt"

$registryOverall = if ($null -ne $releaseEntry) { [string]$releaseEntry.overall_verdict } else { 'missing' }
$prepStatus = if ($null -ne $releaseEntry) { [string]$releaseEntry.prep_status } else { 'missing' }
$preflightStatus = if ($null -ne $releaseEntry) { [string]$releaseEntry.preflight_status } else { 'missing' }
$packageStatus = if ($null -ne $releaseEntry) { [string]$releaseEntry.package_status } else { 'missing' }
$bundleStatus = if ($null -ne $releaseEntry) { [string]$releaseEntry.bundle_status } else { 'missing' }

$summaryText = @(
  "Release Tag: $resolvedReleaseTag",
  "Tag Exists: $tagExists",
  "Git Branch: $($gitMetadata.Branch)",
  "Commit: $($gitMetadata.FullSha)",
  "Registry Overall Verdict: $registryOverall",
  "Prep Status: $prepStatus",
  "Preflight Status: $preflightStatus",
  "Package Status: $packageStatus",
  "Bundle Status: $bundleStatus",
  "Tag Gate Verdict: $tagGateVerdict",
  "Allow Prep Only: $AllowPrepOnly",
  "Generated At (UTC): $([DateTime]::UtcNow.ToString('o'))"
) -join [Environment]::NewLine
Set-Content -Path $summaryTextPath -Value $summaryText -Encoding utf8

$summaryJson = @{
  release_tag = $resolvedReleaseTag
  tag_exists = $tagExists
  git_branch = $gitMetadata.Branch
  commit = $gitMetadata.FullSha
  short_sha = $gitMetadata.ShortSha
  registry_overall_verdict = $registryOverall
  prep_status = $prepStatus
  preflight_status = $preflightStatus
  package_status = $packageStatus
  bundle_status = $bundleStatus
  tag_gate_verdict = $tagGateVerdict
  allow_prep_only = [bool]$AllowPrepOnly
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 5
Set-Content -Path $summaryJsonPath -Value $summaryJson -Encoding utf8

$commandsText = @(
  "Suggested next commands",
  "",
  "1. Rebuild registry if needed:",
  "   pwsh ./scripts/mobile_flutter_release_registry.ps1",
  "",
  "2. Review tag gate summary:",
  "   $summaryTextPath",
  "",
  "3. If tag gate becomes ready, create the tag:",
  "   pwsh ./scripts/mobile_flutter_release_tag.ps1 -ReleaseTag $resolvedReleaseTag -CreateTag",
  "",
  "4. Push the tag only after creation succeeds:",
  "   pwsh ./scripts/mobile_flutter_release_tag.ps1 -ReleaseTag $resolvedReleaseTag -CreateTag -PushTag"
) -join [Environment]::NewLine
Set-Content -Path $commandsPath -Value $commandsText -Encoding utf8

if ($CreateTag) {
  if ($tagGateVerdict -notin @('ready_to_tag', 'ready_to_tag_with_prep_only_override')) {
    throw "Release tag gate is not ready. Current verdict: $tagGateVerdict"
  }
  if ([string]::IsNullOrWhiteSpace($gitMetadata.GitPath)) {
    throw 'git is not available, so the tag cannot be created.'
  }

  $tagMessage = "Business Hub Mobile $resolvedReleaseTag"
  & $gitMetadata.GitPath tag -a $resolvedReleaseTag -m $tagMessage
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create git tag $resolvedReleaseTag"
  }

  if ($PushTag) {
    & $gitMetadata.GitPath push origin $resolvedReleaseTag
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to push git tag $resolvedReleaseTag"
    }
  }
}

Write-Host ''
Write-Host 'Business Hub mobile release tag gate completed successfully.' -ForegroundColor Green
Write-Host "Release tag: $resolvedReleaseTag"
Write-Host "Tag gate verdict: $tagGateVerdict"
Write-Host "Summary text: $summaryTextPath"
Write-Host "Summary JSON: $summaryJsonPath"
Write-Host "Commands: $commandsPath"
