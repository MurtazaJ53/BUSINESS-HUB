[CmdletBinding()]
param(
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

function Resolve-PreviousTag {
  param(
    [string]$ExplicitPreviousTag,
    [string]$CurrentReleaseTag
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPreviousTag)) {
    return $ExplicitPreviousTag.Trim()
  }

  foreach ($tag in Get-MobileReleaseTags) {
    if ($tag -ne $CurrentReleaseTag) {
      return $tag
    }
  }

  return $null
}

function Get-CommitSubjectsSinceTag {
  param([string]$FromTag)

  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($null -eq $git) {
    return @()
  }

  $range = if ([string]::IsNullOrWhiteSpace($FromTag)) { 'HEAD' } else { "$FromTag..HEAD" }
  $rows = & $git.Source log $range '--pretty=format:%h%x09%s' 2>$null
  if ($LASTEXITCODE -ne 0 -or $null -eq $rows) {
    return @()
  }

  $items = @()
  foreach ($row in @($rows)) {
    if ([string]::IsNullOrWhiteSpace($row)) {
      continue
    }
    $parts = $row -split "`t", 2
    $items += [PSCustomObject]@{
      ShortSha = $parts[0].Trim()
      Subject = if ($parts.Count -gt 1) { $parts[1].Trim() } else { '' }
    }
  }
  return $items
}

function Get-ChangedFilesSinceTag {
  param([string]$FromTag)

  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($null -eq $git) {
    return @()
  }

  if ([string]::IsNullOrWhiteSpace($FromTag)) {
    $rows = & $git.Source log --pretty=format: --name-only HEAD 2>$null
  } else {
    $rows = & $git.Source diff --name-only "$FromTag..HEAD" 2>$null
  }

  if ($LASTEXITCODE -ne 0 -or $null -eq $rows) {
    return @()
  }

  return @(
    $rows |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      ForEach-Object { $_.Trim() } |
      Select-Object -Unique
  )
}

function Get-ChangedAreaSummary {
  param([string[]]$Files)

  $counts = [ordered]@{
    mobile_flutter = 0
    backend = 0
    admin_web = 0
    docs = 0
    release_scripts = 0
    ci = 0
    other = 0
  }

  foreach ($file in $Files) {
    if ($file -like 'apps/mobile_flutter/*' -or $file -like 'apps\mobile_flutter\*') {
      $counts.mobile_flutter += 1
    } elseif ($file -like 'apps/backend/*' -or $file -like 'apps\backend\*') {
      $counts.backend += 1
    } elseif ($file -like 'apps/admin_web/*' -or $file -like 'apps\admin_web\*') {
      $counts.admin_web += 1
    } elseif ($file -like 'docs/*' -or $file -like 'docs\*') {
      $counts.docs += 1
    } elseif ($file -like 'scripts/*' -or $file -like 'scripts\*') {
      $counts.release_scripts += 1
    } elseif ($file -like '.github/*' -or $file -like '.github\*') {
      $counts.ci += 1
    } else {
      $counts.other += 1
    }
  }

  return [PSCustomObject]$counts
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
    [string]$ReleaseTypeLabel,
    [string]$PreviousReleaseTag,
    [System.Object[]]$CommitItems
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
  $content = $content -replace '(?m)^- previous stable APK:\s*$', "- previous stable APK: $PreviousReleaseTag"
  $content = $content -replace '(?m)^- previous stable version:\s*$', "- previous stable version: $PreviousReleaseTag"

  $commitLines = @($CommitItems | Select-Object -First 5 | ForEach-Object { "- $($_.Subject) ($($_.ShortSha))" })
  if ($commitLines.Count -eq 0) {
    $commitLines = @('- review recent changes and fill highlights manually')
  }
  $highlightsBlock = ($commitLines -join [Environment]::NewLine)

  $content = [Regex]::Replace(
    $content,
    '(?ms)## Highlights.*?## Operator-facing changes',
    "## Highlights`r`n`r`n$highlightsBlock`r`n`r`n## Operator-facing changes"
  )
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
$previousReleaseTag = Resolve-PreviousTag -ExplicitPreviousTag $PreviousTag -CurrentReleaseTag $releaseTag
$commitItems = Get-CommitSubjectsSinceTag -FromTag $previousReleaseTag
$displayCommitItems = @($commitItems | Select-Object -First $MaxCommitItems)
$changedFiles = Get-ChangedFilesSinceTag -FromTag $previousReleaseTag
$changedAreas = Get-ChangedAreaSummary -Files $changedFiles
$notesDraft = Get-ReleaseNotesDraft `
  -TemplatePath $notesTemplatePath `
  -TargetVersion $targetVersion `
  -TargetBuildNumber $targetBuildNumber `
  -CommitSha $gitMetadata.FullSha `
  -ReleaseChannelLabel $ReleaseChannel `
  -PilotScopeLabel $PilotScope `
  -ShortSha $gitMetadata.ShortSha `
  -ReleaseTypeLabel $ReleaseType `
  -PreviousReleaseTag $(if ($null -ne $previousReleaseTag) { $previousReleaseTag } else { 'none' }) `
  -CommitItems $displayCommitItems

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
  Write-Host "Previous mobile tag: $(if ($null -ne $previousReleaseTag) { $previousReleaseTag } else { '<none>' })"
  Write-Host "Commit count in scope: $($commitItems.Count)"
  Write-Host "Displayed commit items: $($displayCommitItems.Count)"
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
$changelogPath = Join-Path $artifactDir "BusinessHub-Mobile-$releaseTag.changelog.md"

$prepText = @(
  "Current Version: $($currentMetadata.VersionValue)",
  "Target Version: $targetVersionValue",
  "Release Tag: $releaseTag",
  "Previous Mobile Tag: $(if ($null -ne $previousReleaseTag) { $previousReleaseTag } else { 'none' })",
  "Release Type: $ReleaseType",
  "Release Channel: $ReleaseChannel",
  "Pilot Scope: $PilotScope",
  "Commit Count In Scope: $($commitItems.Count)",
  "Displayed Commit Items: $($displayCommitItems.Count)",
  "Changed Areas: mobile_flutter=$($changedAreas.mobile_flutter), backend=$($changedAreas.backend), admin_web=$($changedAreas.admin_web), docs=$($changedAreas.docs), release_scripts=$($changedAreas.release_scripts), ci=$($changedAreas.ci), other=$($changedAreas.other)",
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
  previous_release_tag = $previousReleaseTag
  release_type = $ReleaseType
  release_channel = $ReleaseChannel
  pilot_scope = $PilotScope
  commit_count_in_scope = $commitItems.Count
  displayed_commit_items = $displayCommitItems.Count
  changed_areas = @{
    mobile_flutter = $changedAreas.mobile_flutter
    backend = $changedAreas.backend
    admin_web = $changedAreas.admin_web
    docs = $changedAreas.docs
    release_scripts = $changedAreas.release_scripts
    ci = $changedAreas.ci
    other = $changedAreas.other
  }
  branch = $gitMetadata.Branch
  commit = $gitMetadata.FullSha
  short_sha = $gitMetadata.ShortSha
  apply_version = [bool]$ApplyVersion
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 4
Set-Content -Path $prepJsonPath -Value $prepJson -Encoding utf8

Set-Content -Path $notesDraftPath -Value $notesDraft -Encoding utf8

$changelogLines = New-Object System.Collections.Generic.List[string]
$changelogLines.Add('# Business Hub Mobile Release Changelog')
$changelogLines.Add('')
$changelogLines.Add("- Release tag: $releaseTag")
$changelogLines.Add("- Target version: $targetVersionValue")
$changelogLines.Add("- Previous mobile tag: $(if ($null -ne $previousReleaseTag) { $previousReleaseTag } else { 'none' })")
$changelogLines.Add("- Commit count in scope: $($commitItems.Count)")
$changelogLines.Add("- Displayed commit items: $($displayCommitItems.Count)")
$changelogLines.Add('')
$changelogLines.Add('## Changed areas')
$changelogLines.Add('')
$changelogLines.Add("- mobile_flutter: $($changedAreas.mobile_flutter)")
$changelogLines.Add("- backend: $($changedAreas.backend)")
$changelogLines.Add("- admin_web: $($changedAreas.admin_web)")
$changelogLines.Add("- docs: $($changedAreas.docs)")
$changelogLines.Add("- release_scripts: $($changedAreas.release_scripts)")
$changelogLines.Add("- ci: $($changedAreas.ci)")
$changelogLines.Add("- other: $($changedAreas.other)")
$changelogLines.Add('')
$changelogLines.Add('## Commit subjects')
$changelogLines.Add('')
if ($displayCommitItems.Count -eq 0) {
  $changelogLines.Add('- no commits found in the selected range')
} else {
  foreach ($item in $displayCommitItems) {
    $changelogLines.Add("- $($item.Subject) ($($item.ShortSha))")
  }
  if ($displayCommitItems.Count -lt $commitItems.Count) {
    $changelogLines.Add('')
    $changelogLines.Add("- truncated: showing first $($displayCommitItems.Count) of $($commitItems.Count) commits in scope")
  }
}
Set-Content -Path $changelogPath -Value ($changelogLines -join [Environment]::NewLine) -Encoding utf8

$commandsText = @(
  "Suggested next commands",
  "",
  "1. Review draft notes:",
  "   $notesDraftPath",
  "   $changelogPath",
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
Write-Host "Changelog: $changelogPath"
Write-Host "Commands: $commandsPath"
if ($ApplyVersion) {
  Write-Host "Updated pubspec: $pubspecPath"
}
