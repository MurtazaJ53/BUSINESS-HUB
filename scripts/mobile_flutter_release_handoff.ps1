[CmdletBinding()]
param(
  [string]$ReleaseTag,
  [string]$RegistryPath = 'release-artifacts\mobile-release-registry.json',
  [string]$BundleRoot = 'release-artifacts\mobile-bundles',
  [string]$TagRoot = 'release-artifacts\mobile-tags',
  [string]$OutputRoot = 'release-artifacts\mobile-handoffs',
  [switch]$Strict,
  [switch]$Zip,
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

function Get-JsonFileData {
  param([string]$FilePath)

  if (-not (Test-Path $FilePath)) {
    return $null
  }

  $content = Get-Content -Raw -Path $FilePath
  if ([string]::IsNullOrWhiteSpace($content)) {
    return $null
  }

  return $content | ConvertFrom-Json
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

  $bundleBase = Join-Path $repoRoot $BundleRoot
  if (Test-Path $bundleBase) {
    $dir = Get-ChildItem -Directory -Path $bundleBase | Sort-Object Name -Descending | Select-Object -First 1
    if ($null -ne $dir) {
      return $dir.Name
    }
  }

  throw 'Could not resolve a release tag. Pass -ReleaseTag explicitly.'
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

function Get-FileManifest {
  param(
    [string]$BaseDirectory,
    [string[]]$RequiredFiles
  )

  $items = @()
  foreach ($relativePath in $RequiredFiles) {
    $fullPath = Join-Path $BaseDirectory $relativePath
    $exists = Test-Path $fullPath
    $size = if ($exists) { (Get-Item $fullPath).Length } else { 0 }
    $items += [PSCustomObject]@{
      RelativePath = $relativePath
      FullPath = $fullPath
      Exists = $exists
      Size = $size
    }
  }
  return $items
}

function Get-SectionStatus {
  param([System.Object[]]$Items)

  $present = @($Items | Where-Object { $_.Exists })
  if ($present.Count -eq 0) {
    return 'missing'
  }
  if ($present.Count -eq $Items.Count) {
    return 'complete'
  }
  return 'partial'
}

function Copy-ExistingFiles {
  param(
    [System.Object[]]$Items,
    [string]$TargetDirectory
  )

  foreach ($item in $Items) {
    if (-not $item.Exists) {
      continue
    }
    $targetPath = Join-Path $TargetDirectory $item.RelativePath
    $targetParent = Split-Path -Parent $targetPath
    New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
    Copy-Item -Path $item.FullPath -Destination $targetPath -Force
  }
}

function Copy-DirectoryTree {
  param(
    [string]$SourceDirectory,
    [string]$TargetDirectory
  )

  if (-not (Test-Path $SourceDirectory)) {
    return
  }

  New-Item -ItemType Directory -Force -Path $TargetDirectory | Out-Null
  Copy-Item -Path (Join-Path $SourceDirectory '*') -Destination $TargetDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

function Get-HandoffVerdict {
  param(
    [bool]$HasRegistryEntry,
    [string]$RegistryStatus,
    [string]$BundleStatus,
    [string]$TagStatus,
    [string]$RegistryOverallVerdict,
    [string]$TagGateVerdict
  )

  if (-not $HasRegistryEntry -or $RegistryStatus -eq 'missing' -or $BundleStatus -eq 'missing') {
    return 'handoff_blocked'
  }

  if ($RegistryStatus -eq 'complete' -and $BundleStatus -eq 'complete' -and $TagStatus -eq 'complete') {
    if ($RegistryOverallVerdict -eq 'bundle_ready' -and $TagGateVerdict -in @('ready_to_tag', 'tag_exists')) {
      return 'handoff_ready'
    }
    return 'handoff_partial'
  }

  return 'handoff_partial'
}

$gitMetadata = Get-GitMetadata
$registryFilePath = Join-Path $repoRoot $RegistryPath
$registryDirectory = Split-Path -Parent $registryFilePath
$registryData = Get-JsonFileData -FilePath $registryFilePath
$existingTags = Get-MobileReleaseTags -GitPath $gitMetadata.GitPath
$resolvedReleaseTag = Resolve-ReleaseTag -ExplicitReleaseTag $ReleaseTag -RegistryData $registryData -ExistingTags $existingTags

$bundleDir = Join-Path $repoRoot (Join-Path $BundleRoot $resolvedReleaseTag)
$tagDir = Join-Path $repoRoot (Join-Path $TagRoot $resolvedReleaseTag)
$outputBase = Join-Path $repoRoot $OutputRoot
$outputDir = Join-Path $outputBase $resolvedReleaseTag
$zipPath = Join-Path $outputBase "BusinessHub-Mobile-$resolvedReleaseTag.handoff.zip"

$releaseEntry = Get-ReleaseEntryFromRegistry -RegistryData $registryData -Tag $resolvedReleaseTag
$bundleFiles = Get-FileManifest -BaseDirectory $bundleDir -RequiredFiles @(
  "BusinessHub-Mobile-$resolvedReleaseTag.bundle-summary.txt",
  "BusinessHub-Mobile-$resolvedReleaseTag.bundle-summary.json",
  "BusinessHub-Mobile-$resolvedReleaseTag.bundle-handoff.md"
)
$tagFiles = Get-FileManifest -BaseDirectory $tagDir -RequiredFiles @(
  "BusinessHub-Mobile-$resolvedReleaseTag.tag-summary.txt",
  "BusinessHub-Mobile-$resolvedReleaseTag.tag-summary.json",
  "BusinessHub-Mobile-$resolvedReleaseTag.tag-commands.txt"
)
$registryFiles = Get-FileManifest -BaseDirectory $registryDirectory -RequiredFiles @(
  'mobile-release-registry.json',
  'mobile-release-registry.md'
)

$bundleStatus = Get-SectionStatus -Items $bundleFiles
$tagStatus = Get-SectionStatus -Items $tagFiles
$registryStatus = Get-SectionStatus -Items $registryFiles
$tagSummaryJsonPath = Join-Path $tagDir "BusinessHub-Mobile-$resolvedReleaseTag.tag-summary.json"
$tagSummary = Get-JsonFileData -FilePath $tagSummaryJsonPath
$tagGateVerdict = if ($null -ne $tagSummary) { [string]$tagSummary.tag_gate_verdict } else { 'missing' }
$registryOverallVerdict = if ($null -ne $releaseEntry) { [string]$releaseEntry.overall_verdict } else { 'missing' }
$handoffVerdict = Get-HandoffVerdict `
  -HasRegistryEntry ($null -ne $releaseEntry) `
  -RegistryStatus $registryStatus `
  -BundleStatus $bundleStatus `
  -TagStatus $tagStatus `
  -RegistryOverallVerdict $registryOverallVerdict `
  -TagGateVerdict $tagGateVerdict

if ($Doctor) {
  Write-Host "Repo root: $repoRoot"
  Write-Host "Registry: $registryFilePath"
  Write-Host "Release tag: $resolvedReleaseTag"
  Write-Host "Bundle dir: $bundleDir"
  Write-Host "Tag dir: $tagDir"
  Write-Host "Output dir: $outputDir"
  Write-Host "Registry status: $registryStatus"
  Write-Host "Bundle status: $bundleStatus"
  Write-Host "Tag status: $tagStatus"
  Write-Host "Registry overall verdict: $registryOverallVerdict"
  Write-Host "Tag gate verdict: $tagGateVerdict"
  Write-Host "Handoff verdict: $handoffVerdict"
  Write-Host "Zip path: $zipPath"
  exit 0
}

if ($Strict -and $handoffVerdict -ne 'handoff_ready') {
  throw "Strict handoff mode requires a handoff_ready verdict. Current verdict: $handoffVerdict"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$bundleTargetDir = Join-Path $outputDir 'bundle'
$tagTargetDir = Join-Path $outputDir 'tag'
$registryTargetDir = Join-Path $outputDir 'registry'

foreach ($target in @($bundleTargetDir, $tagTargetDir, $registryTargetDir)) {
  if (Test-Path $target) {
    Remove-Item -Recurse -Force -Path $target
  }
}

Copy-DirectoryTree -SourceDirectory $bundleDir -TargetDirectory $bundleTargetDir
Copy-DirectoryTree -SourceDirectory $tagDir -TargetDirectory $tagTargetDir
Copy-ExistingFiles -Items $registryFiles -TargetDirectory $registryTargetDir

if ($null -ne $releaseEntry) {
  $registryEntryPath = Join-Path $registryTargetDir "BusinessHub-Mobile-$resolvedReleaseTag.registry-entry.json"
  $releaseEntry | ConvertTo-Json -Depth 6 | Set-Content -Path $registryEntryPath -Encoding utf8
}

$summaryTextPath = Join-Path $outputDir "BusinessHub-Mobile-$resolvedReleaseTag.handoff-summary.txt"
$summaryJsonPath = Join-Path $outputDir "BusinessHub-Mobile-$resolvedReleaseTag.handoff-summary.json"
$readmePath = Join-Path $outputDir "BusinessHub-Mobile-$resolvedReleaseTag.handoff-readme.md"

$summaryText = @(
  "Release Tag: $resolvedReleaseTag",
  "Handoff Verdict: $handoffVerdict",
  "Registry Status: $registryStatus",
  "Registry Overall Verdict: $registryOverallVerdict",
  "Bundle Status: $bundleStatus",
  "Tag Status: $tagStatus",
  "Tag Gate Verdict: $tagGateVerdict",
  "Git Branch: $($gitMetadata.Branch)",
  "Commit: $($gitMetadata.FullSha)",
  "Short SHA: $($gitMetadata.ShortSha)",
  "Handoff Directory: $outputDir",
  "Zip Enabled: $Zip",
  "Generated At (UTC): $([DateTime]::UtcNow.ToString('o'))"
) -join [Environment]::NewLine
Set-Content -Path $summaryTextPath -Value $summaryText -Encoding utf8

$summaryJsonObject = @{
  release_tag = $resolvedReleaseTag
  handoff_verdict = $handoffVerdict
  registry_status = $registryStatus
  registry_overall_verdict = $registryOverallVerdict
  bundle_status = $bundleStatus
  tag_status = $tagStatus
  tag_gate_verdict = $tagGateVerdict
  git_branch = $gitMetadata.Branch
  commit = $gitMetadata.FullSha
  short_sha = $gitMetadata.ShortSha
  handoff_directory = $outputDir
  bundle_directory = $bundleDir
  tag_directory = $tagDir
  registry_path = $registryFilePath
  zip_enabled = [bool]$Zip
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
  files = @{
    bundle = @($bundleFiles | ForEach-Object {
      @{
        path = $_.RelativePath
        exists = $_.Exists
        size = $_.Size
      }
    })
    tag = @($tagFiles | ForEach-Object {
      @{
        path = $_.RelativePath
        exists = $_.Exists
        size = $_.Size
      }
    })
    registry = @($registryFiles | ForEach-Object {
      @{
        path = $_.RelativePath
        exists = $_.Exists
        size = $_.Size
      }
    })
  }
}

if ($null -ne $releaseEntry) {
  $summaryJsonObject.release_registry_entry = $releaseEntry
}

$summaryJsonObject | ConvertTo-Json -Depth 8 | Set-Content -Path $summaryJsonPath -Encoding utf8

$readmeLines = New-Object System.Collections.Generic.List[string]
$readmeLines.Add('# Business Hub Mobile Release Handoff Pack')
$readmeLines.Add('')
$readmeLines.Add("- Release tag: $resolvedReleaseTag")
$readmeLines.Add("- Handoff verdict: $handoffVerdict")
$readmeLines.Add("- Registry overall verdict: $registryOverallVerdict")
$readmeLines.Add("- Tag gate verdict: $tagGateVerdict")
$readmeLines.Add("- Bundle status: $bundleStatus")
$readmeLines.Add("- Tag status: $tagStatus")
$readmeLines.Add("- Registry snapshot status: $registryStatus")
$readmeLines.Add("- Git branch: $($gitMetadata.Branch)")
$readmeLines.Add("- Commit: $($gitMetadata.FullSha)")
$readmeLines.Add('')
$readmeLines.Add('## Included sections')
$readmeLines.Add('')
$readmeLines.Add("- bundle")
$readmeLines.Add("- tag")
$readmeLines.Add("- registry")
$readmeLines.Add('')
$readmeLines.Add('## Next action')
$readmeLines.Add('')
switch ($handoffVerdict) {
  'handoff_ready' {
    $readmeLines.Add('- the release pack is ready for rollout lead handoff and archive placement')
  }
  'handoff_partial' {
    if ($registryOverallVerdict -eq 'prep_only') {
      $readmeLines.Add('- prep is done, but the local preflight/package stages still need to catch up before final tagging')
    } elseif ($tagGateVerdict -eq 'blocked') {
      $readmeLines.Add('- rebuild the release registry or complete the missing release stages, then rerun the tag gate')
    } else {
      $readmeLines.Add('- the handoff folder is useful, but one or more upstream stages are still incomplete')
    }
  }
  default {
    $readmeLines.Add('- generate the bundle and registry snapshot first, then rerun the handoff runner')
  }
}
Set-Content -Path $readmePath -Value ($readmeLines -join [Environment]::NewLine) -Encoding utf8

if ($Zip) {
  if (Test-Path $zipPath) {
    Remove-Item -Force -Path $zipPath
  }
  Compress-Archive -Path (Join-Path $outputDir '*') -DestinationPath $zipPath -Force
}

Write-Host ''
Write-Host 'Business Hub mobile release handoff pack completed successfully.' -ForegroundColor Green
Write-Host "Release tag: $resolvedReleaseTag"
Write-Host "Handoff verdict: $handoffVerdict"
Write-Host "Handoff dir: $outputDir"
Write-Host "Summary text: $summaryTextPath"
Write-Host "Summary JSON: $summaryJsonPath"
Write-Host "Readme: $readmePath"
if ($Zip) {
  Write-Host "Zip: $zipPath"
}
