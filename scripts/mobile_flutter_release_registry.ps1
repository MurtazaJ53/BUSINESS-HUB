[CmdletBinding()]
param(
  [string]$PrepRoot = 'release-artifacts\mobile-prep',
  [string]$LocalRoot = 'release-artifacts\mobile-local',
  [string]$BundleRoot = 'release-artifacts\mobile-bundles',
  [string]$OutputRoot = 'release-artifacts',
  [switch]$Doctor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

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

function Get-MobileReleaseTags {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($null -eq $git) {
    return @()
  }

  $tags = & $git.Source tag --list 'mobile-v*' --sort=-version:refname 2>$null
  if ($LASTEXITCODE -ne 0 -or $null -eq $tags) {
    return @()
  }

  return @($tags | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim() })
}

function Get-TagDirectories {
  param([string]$RootPath)

  if (-not (Test-Path $RootPath)) {
    return @()
  }

  return @(
    Get-ChildItem -Directory -Path $RootPath |
      Where-Object { $_.Name -like 'mobile-v*' } |
      ForEach-Object { $_.Name }
  )
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

function Get-BundleVerdict {
  param(
    [string]$PrepStatus,
    [string]$PreflightStatus,
    [string]$PackageStatus,
    [string]$BundleStatus
  )

  if ($BundleStatus -eq 'complete' -and $PackageStatus -eq 'complete') {
    return 'bundle_ready'
  }
  if ($PrepStatus -eq 'missing') {
    return 'blocked_missing_prep'
  }
  if ($PackageStatus -eq 'complete') {
    return 'package_ready_unbundled'
  }
  if ($PreflightStatus -eq 'complete') {
    return 'preflight_only'
  }
  if ($PrepStatus -eq 'complete') {
    return 'prep_only'
  }
  return 'incomplete'
}

function Get-ReleaseEntry {
  param(
    [string]$Tag,
    [string]$PrepBase,
    [string]$LocalBase,
    [string]$BundleBase
  )

  $prepDir = Join-Path $PrepBase $Tag
  $localDir = Join-Path $LocalBase $Tag
  $bundleDir = Join-Path $BundleBase $Tag

  $prepFiles = Get-FileManifest -BaseDirectory $prepDir -RequiredFiles @(
    "BusinessHub-Mobile-$Tag.prep.txt",
    "BusinessHub-Mobile-$Tag.prep.json",
    "BusinessHub-Mobile-$Tag.release-notes.md",
    "BusinessHub-Mobile-$Tag.changelog.md",
    "BusinessHub-Mobile-$Tag.commands.txt"
  )
  $preflightFiles = Get-FileManifest -BaseDirectory $localDir -RequiredFiles @(
    "BusinessHub-Mobile-$Tag.preflight.txt",
    "BusinessHub-Mobile-$Tag.preflight.json"
  )
  $packageFiles = Get-FileManifest -BaseDirectory $localDir -RequiredFiles @(
    "BusinessHub-Mobile-$Tag.apk",
    "BusinessHub-Mobile-$Tag.apk.sha256",
    "BusinessHub-Mobile-$Tag.manifest.txt",
    "BusinessHub-Mobile-$Tag.manifest.json",
    "BusinessHub-Mobile-$Tag.handoff.md"
  )
  $bundleFiles = Get-FileManifest -BaseDirectory $bundleDir -RequiredFiles @(
    "BusinessHub-Mobile-$Tag.bundle-summary.txt",
    "BusinessHub-Mobile-$Tag.bundle-summary.json",
    "BusinessHub-Mobile-$Tag.bundle-handoff.md"
  )

  $prepStatus = Get-SectionStatus -Items $prepFiles
  $preflightStatus = Get-SectionStatus -Items $preflightFiles
  $packageStatus = Get-SectionStatus -Items $packageFiles
  $bundleStatus = Get-SectionStatus -Items $bundleFiles
  $overallVerdict = Get-BundleVerdict -PrepStatus $prepStatus -PreflightStatus $preflightStatus -PackageStatus $packageStatus -BundleStatus $bundleStatus

  return [PSCustomObject]@{
    tag = $Tag
    prep_directory = $prepDir
    local_directory = $localDir
    bundle_directory = $bundleDir
    prep_status = $prepStatus
    preflight_status = $preflightStatus
    package_status = $packageStatus
    bundle_status = $bundleStatus
    overall_verdict = $overallVerdict
    prep_files_present = @($prepFiles | Where-Object { $_.Exists }).Count
    preflight_files_present = @($preflightFiles | Where-Object { $_.Exists }).Count
    package_files_present = @($packageFiles | Where-Object { $_.Exists }).Count
    bundle_files_present = @($bundleFiles | Where-Object { $_.Exists }).Count
  }
}

$prepBase = Join-Path $repoRoot $PrepRoot
$localBase = Join-Path $repoRoot $LocalRoot
$bundleBase = Join-Path $repoRoot $BundleRoot
$outputBase = Join-Path $repoRoot $OutputRoot
$gitMetadata = Get-GitMetadata

$tags = New-Object System.Collections.Generic.List[string]
foreach ($tag in Get-MobileReleaseTags) { if (-not $tags.Contains($tag)) { $tags.Add($tag) } }
foreach ($tag in Get-TagDirectories -RootPath $prepBase) { if (-not $tags.Contains($tag)) { $tags.Add($tag) } }
foreach ($tag in Get-TagDirectories -RootPath $localBase) { if (-not $tags.Contains($tag)) { $tags.Add($tag) } }
foreach ($tag in Get-TagDirectories -RootPath $bundleBase) { if (-not $tags.Contains($tag)) { $tags.Add($tag) } }

$sortedTags = @($tags | Sort-Object { $_ } -Descending)
$entries = @()
foreach ($tag in $sortedTags) {
  $entries += Get-ReleaseEntry -Tag $tag -PrepBase $prepBase -LocalBase $localBase -BundleBase $bundleBase
}

if ($Doctor) {
  Write-Host "Repo root: $repoRoot"
  Write-Host "Prep base: $prepBase"
  Write-Host "Local base: $localBase"
  Write-Host "Bundle base: $bundleBase"
  Write-Host "Output base: $outputBase"
  Write-Host "Git branch: $($gitMetadata.Branch)"
  Write-Host "Commit: $($gitMetadata.FullSha)"
  Write-Host "Discovered tags: $($entries.Count)"
  foreach ($entry in $entries) {
    Write-Host "  - $($entry.tag): $($entry.overall_verdict)"
  }
  exit 0
}

New-Item -ItemType Directory -Force -Path $outputBase | Out-Null

$registryJsonPath = Join-Path $outputBase 'mobile-release-registry.json'
$registryMdPath = Join-Path $outputBase 'mobile-release-registry.md'

$registryObject = @{
  git_branch = $gitMetadata.Branch
  commit = $gitMetadata.FullSha
  short_sha = $gitMetadata.ShortSha
  release_count = $entries.Count
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
  releases = $entries
}
$registryJson = $registryObject | ConvertTo-Json -Depth 6
Set-Content -Path $registryJsonPath -Value $registryJson -Encoding utf8

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Business Hub Mobile Release Registry')
$lines.Add('')
$lines.Add("- Git branch: $($gitMetadata.Branch)")
$lines.Add("- Commit: $($gitMetadata.FullSha)")
$lines.Add("- Release count: $($entries.Count)")
$lines.Add("- Generated at (UTC): $([DateTime]::UtcNow.ToString('o'))")
$lines.Add('')
$lines.Add('| Release Tag | Overall | Prep | Preflight | Package | Bundle |')
$lines.Add('| --- | --- | --- | --- | --- | --- |')
foreach ($entry in $entries) {
  $lines.Add("| $($entry.tag) | $($entry.overall_verdict) | $($entry.prep_status) | $($entry.preflight_status) | $($entry.package_status) | $($entry.bundle_status) |")
}
$lines.Add('')
$lines.Add('## Release directories')
$lines.Add('')
foreach ($entry in $entries) {
  $lines.Add("### $($entry.tag)")
  $lines.Add("- prep: $($entry.prep_directory)")
  $lines.Add("- local: $($entry.local_directory)")
  $lines.Add("- bundle: $($entry.bundle_directory)")
  $lines.Add('')
}
Set-Content -Path $registryMdPath -Value ($lines -join [Environment]::NewLine) -Encoding utf8

Write-Host ''
Write-Host 'Business Hub mobile release registry completed successfully.' -ForegroundColor Green
Write-Host "Registry JSON: $registryJsonPath"
Write-Host "Registry Markdown: $registryMdPath"
Write-Host "Release count: $($entries.Count)"
