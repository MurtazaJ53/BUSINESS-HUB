[CmdletBinding()]
param(
  [string]$ReleaseTag,
  [string]$PrepRoot = 'release-artifacts\mobile-prep',
  [string]$LocalRoot = 'release-artifacts\mobile-local',
  [string]$BundleRoot = 'release-artifacts\mobile-bundles',
  [switch]$Strict,
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

function Resolve-ReleaseTag {
  param([string]$ExplicitReleaseTag)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitReleaseTag)) {
    return $ExplicitReleaseTag.Trim()
  }

  $prepBase = Join-Path $repoRoot $PrepRoot
  if (Test-Path $prepBase) {
    $dir = Get-ChildItem -Directory -Path $prepBase | Sort-Object Name -Descending | Select-Object -First 1
    if ($null -ne $dir) {
      return $dir.Name
    }
  }

  $tags = Get-MobileReleaseTags
  if ($tags.Count -gt 0) {
    return $tags[0]
  }

  throw 'Could not resolve a release tag. Pass -ReleaseTag explicitly.'
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

function Get-BundleVerdict {
  param(
    [string]$PrepStatus,
    [string]$PreflightStatus,
    [string]$PackageStatus
  )

  if ($PrepStatus -eq 'missing') {
    return 'blocked_missing_prep'
  }
  if ($PackageStatus -eq 'complete') {
    return 'bundle_ready'
  }
  if ($PreflightStatus -eq 'complete') {
    return 'preflight_only'
  }
  if ($PrepStatus -eq 'complete') {
    return 'prep_only'
  }
  return 'incomplete'
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

$resolvedReleaseTag = Resolve-ReleaseTag -ExplicitReleaseTag $ReleaseTag
$prepDir = Join-Path $repoRoot (Join-Path $PrepRoot $resolvedReleaseTag)
$localDir = Join-Path $repoRoot (Join-Path $LocalRoot $resolvedReleaseTag)
$bundleDir = Join-Path $repoRoot (Join-Path $BundleRoot $resolvedReleaseTag)
$gitMetadata = Get-GitMetadata

$prepFiles = Get-FileManifest -BaseDirectory $prepDir -RequiredFiles @(
  "BusinessHub-Mobile-$resolvedReleaseTag.prep.txt",
  "BusinessHub-Mobile-$resolvedReleaseTag.prep.json",
  "BusinessHub-Mobile-$resolvedReleaseTag.release-notes.md",
  "BusinessHub-Mobile-$resolvedReleaseTag.changelog.md",
  "BusinessHub-Mobile-$resolvedReleaseTag.commands.txt"
)

$preflightFiles = Get-FileManifest -BaseDirectory $localDir -RequiredFiles @(
  "BusinessHub-Mobile-$resolvedReleaseTag.preflight.txt",
  "BusinessHub-Mobile-$resolvedReleaseTag.preflight.json"
)

$packageFiles = Get-FileManifest -BaseDirectory $localDir -RequiredFiles @(
  "BusinessHub-Mobile-$resolvedReleaseTag.apk",
  "BusinessHub-Mobile-$resolvedReleaseTag.apk.sha256",
  "BusinessHub-Mobile-$resolvedReleaseTag.manifest.txt",
  "BusinessHub-Mobile-$resolvedReleaseTag.manifest.json",
  "BusinessHub-Mobile-$resolvedReleaseTag.handoff.md"
)

$prepStatus = Get-SectionStatus -Items $prepFiles
$preflightStatus = Get-SectionStatus -Items $preflightFiles
$packageStatus = Get-SectionStatus -Items $packageFiles
$bundleVerdict = Get-BundleVerdict -PrepStatus $prepStatus -PreflightStatus $preflightStatus -PackageStatus $packageStatus

if ($Doctor) {
  Write-Host "Repo root: $repoRoot"
  Write-Host "Release tag: $resolvedReleaseTag"
  Write-Host "Prep dir: $prepDir"
  Write-Host "Local dir: $localDir"
  Write-Host "Bundle dir: $bundleDir"
  Write-Host "Prep status: $prepStatus"
  Write-Host "Preflight status: $preflightStatus"
  Write-Host "Package status: $packageStatus"
  Write-Host "Bundle verdict: $bundleVerdict"
  exit 0
}

if ($Strict -and $bundleVerdict -ne 'bundle_ready') {
  throw "Strict bundle mode requires a complete release package. Current verdict: $bundleVerdict"
}

New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null
$prepTargetDir = Join-Path $bundleDir 'prep'
$localTargetDir = Join-Path $bundleDir 'local'

Copy-ExistingFiles -Items $prepFiles -TargetDirectory $prepTargetDir
Copy-ExistingFiles -Items $preflightFiles -TargetDirectory $localTargetDir
Copy-ExistingFiles -Items $packageFiles -TargetDirectory $localTargetDir

$summaryTextPath = Join-Path $bundleDir "BusinessHub-Mobile-$resolvedReleaseTag.bundle-summary.txt"
$summaryJsonPath = Join-Path $bundleDir "BusinessHub-Mobile-$resolvedReleaseTag.bundle-summary.json"
$handoffPath = Join-Path $bundleDir "BusinessHub-Mobile-$resolvedReleaseTag.bundle-handoff.md"

$summaryText = @(
  "Release Tag: $resolvedReleaseTag",
  "Bundle Verdict: $bundleVerdict",
  "Prep Status: $prepStatus",
  "Preflight Status: $preflightStatus",
  "Package Status: $packageStatus",
  "Git Branch: $($gitMetadata.Branch)",
  "Commit: $($gitMetadata.FullSha)",
  "Short SHA: $($gitMetadata.ShortSha)",
  "Bundle Directory: $bundleDir",
  "Generated At (UTC): $([DateTime]::UtcNow.ToString('o'))"
) -join [Environment]::NewLine
Set-Content -Path $summaryTextPath -Value $summaryText -Encoding utf8

$summaryJson = @{
  release_tag = $resolvedReleaseTag
  bundle_verdict = $bundleVerdict
  prep_status = $prepStatus
  preflight_status = $preflightStatus
  package_status = $packageStatus
  git_branch = $gitMetadata.Branch
  commit = $gitMetadata.FullSha
  short_sha = $gitMetadata.ShortSha
  bundle_directory = $bundleDir
  files = @{
    prep = @($prepFiles | ForEach-Object {
      @{
        path = $_.RelativePath
        exists = $_.Exists
        size = $_.Size
      }
    })
    preflight = @($preflightFiles | ForEach-Object {
      @{
        path = $_.RelativePath
        exists = $_.Exists
        size = $_.Size
      }
    })
    package = @($packageFiles | ForEach-Object {
      @{
        path = $_.RelativePath
        exists = $_.Exists
        size = $_.Size
      }
    })
  }
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 6
Set-Content -Path $summaryJsonPath -Value $summaryJson -Encoding utf8

$handoffLines = New-Object System.Collections.Generic.List[string]
$handoffLines.Add('# Business Hub Mobile Release Bundle')
$handoffLines.Add('')
$handoffLines.Add("- Release tag: $resolvedReleaseTag")
$handoffLines.Add("- Bundle verdict: $bundleVerdict")
$handoffLines.Add("- Prep status: $prepStatus")
$handoffLines.Add("- Preflight status: $preflightStatus")
$handoffLines.Add("- Package status: $packageStatus")
$handoffLines.Add("- Git branch: $($gitMetadata.Branch)")
$handoffLines.Add("- Commit: $($gitMetadata.FullSha)")
$handoffLines.Add('')
$handoffLines.Add('## Included sections')
$handoffLines.Add('')
$handoffLines.Add("- prep")
$handoffLines.Add("- local preflight")
$handoffLines.Add("- local package")
$handoffLines.Add('')
$handoffLines.Add('## Next action')
$handoffLines.Add('')
switch ($bundleVerdict) {
  'bundle_ready' {
    $handoffLines.Add('- release evidence is consolidated and ready for operator handoff')
  }
  'preflight_only' {
    $handoffLines.Add('- preflight is present, but the signed/local package is still missing')
  }
  'prep_only' {
    $handoffLines.Add('- release prep is complete; run local preflight next')
  }
  default {
    $handoffLines.Add('- bundle is incomplete; finish prep/preflight/package stages before handoff')
  }
}
Set-Content -Path $handoffPath -Value ($handoffLines -join [Environment]::NewLine) -Encoding utf8

Write-Host ''
Write-Host 'Business Hub mobile release bundle completed successfully.' -ForegroundColor Green
Write-Host "Release tag: $resolvedReleaseTag"
Write-Host "Bundle verdict: $bundleVerdict"
Write-Host "Bundle dir: $bundleDir"
Write-Host "Summary text: $summaryTextPath"
Write-Host "Summary JSON: $summaryJsonPath"
Write-Host "Handoff: $handoffPath"
