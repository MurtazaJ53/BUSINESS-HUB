[CmdletBinding()]
param(
  [string]$FlutterRoot,
  [string]$ReleaseTag,
  [string]$ReleaseChannel = 'pilot',
  [string]$PilotScope = 'pilot-unspecified',
  [string]$ArtifactRoot = 'release-artifacts\mobile-local',
  [switch]$SkipPubGet,
  [switch]$SkipCodegen,
  [switch]$SkipAnalyze,
  [switch]$SkipTest,
  [switch]$SkipBuild,
  [switch]$Doctor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$appDir = Join-Path $repoRoot 'apps\mobile_flutter'
$pubspecPath = Join-Path $appDir 'pubspec.yaml'
$androidDir = Join-Path $appDir 'android'
$keyPropertiesPath = Join-Path $androidDir 'key.properties'

function Resolve-FlutterExecutable {
  param([string]$ExplicitRoot)

  $candidates = New-Object System.Collections.Generic.List[string]

  if (-not [string]::IsNullOrWhiteSpace($ExplicitRoot)) {
    $candidates.Add((Join-Path $ExplicitRoot 'bin\flutter.bat'))
    $candidates.Add((Join-Path $ExplicitRoot 'bin\flutter'))
  }

  foreach ($envName in @('BUSINESS_HUB_FLUTTER_HOME', 'FLUTTER_HOME')) {
    if (Test-Path "Env:$envName") {
      $envRoot = (Get-Item "Env:$envName").Value
      if (-not [string]::IsNullOrWhiteSpace($envRoot)) {
        $candidates.Add((Join-Path $envRoot 'bin\flutter.bat'))
        $candidates.Add((Join-Path $envRoot 'bin\flutter'))
      }
    }
  }

  foreach ($commandName in @('flutter.bat', 'flutter')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
      $candidates.Add($command.Source)
    }
  }

  foreach ($root in @(
    'C:\src\flutter',
    'C:\flutter',
    (Join-Path $env:USERPROFILE 'flutter'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Flutter')
  )) {
    $candidates.Add((Join-Path $root 'bin\flutter.bat'))
    $candidates.Add((Join-Path $root 'bin\flutter'))
  }

  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }
    if (Test-Path $candidate) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }

  return $null
}

function Resolve-DartExecutable {
  param([string]$FlutterExecutable)

  if ([string]::IsNullOrWhiteSpace($FlutterExecutable)) {
    return $null
  }

  $flutterBin = Split-Path -Parent $FlutterExecutable
  foreach ($candidate in @(
    (Join-Path $flutterBin 'dart.bat'),
    (Join-Path $flutterBin 'dart')
  )) {
    if (Test-Path $candidate) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }

  foreach ($commandName in @('dart.bat', 'dart')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
      return $command.Source
    }
  }

  return $null
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$Label,
    [hashtable]$ExtraEnvironment
  )

  Write-Host ''
  Write-Host "==> $Label" -ForegroundColor Cyan
  Write-Host "$FilePath $($Arguments -join ' ')" -ForegroundColor DarkGray

  $oldValues = @{}
  if ($null -ne $ExtraEnvironment) {
    foreach ($pair in $ExtraEnvironment.GetEnumerator()) {
      $oldValues[$pair.Key] = [Environment]::GetEnvironmentVariable($pair.Key, 'Process')
      [Environment]::SetEnvironmentVariable($pair.Key, $pair.Value, 'Process')
    }
  }

  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$Label failed with exit code $LASTEXITCODE."
    }
  } finally {
    if ($null -ne $ExtraEnvironment) {
      foreach ($pair in $ExtraEnvironment.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($pair.Key, $oldValues[$pair.Key], 'Process')
      }
    }
  }
}

function Show-ResolveHelp {
  Write-Host ''
  Write-Host 'Flutter SDK was not found.' -ForegroundColor Yellow
  Write-Host 'Try one of these options:' -ForegroundColor Yellow
  Write-Host '  1. Install Flutter locally.' -ForegroundColor Yellow
  Write-Host '  2. Set BUSINESS_HUB_FLUTTER_HOME or FLUTTER_HOME.' -ForegroundColor Yellow
  Write-Host '  3. Pass -FlutterRoot C:\path\to\flutter when running this script.' -ForegroundColor Yellow
}

function Get-PubspecMetadata {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "pubspec.yaml not found: $Path"
  }

  $versionLine = Select-String -Path $Path -Pattern '^\s*version:\s*(.+)\s*$' | Select-Object -First 1
  if ($null -eq $versionLine) {
    throw "Could not find a version entry in $Path"
  }

  $versionValue = $versionLine.Matches[0].Groups[1].Value.Trim()
  $marketingVersion = $versionValue
  $buildNumber = '0'
  if ($versionValue.Contains('+')) {
    $parts = $versionValue.Split('+', 2)
    $marketingVersion = $parts[0]
    $buildNumber = $parts[1]
  }

  return [PSCustomObject]@{
    VersionLine = $versionValue
    MarketingVersion = $marketingVersion
    BuildNumber = $buildNumber
  }
}

function Get-SigningReadiness {
  param([string]$Path)

  $envReady =
    -not [string]::IsNullOrWhiteSpace($env:ANDROID_KEYSTORE_PATH) -and
    -not [string]::IsNullOrWhiteSpace($env:ANDROID_KEYSTORE_PASSWORD) -and
    -not [string]::IsNullOrWhiteSpace($env:ANDROID_KEY_ALIAS) -and
    -not [string]::IsNullOrWhiteSpace($env:ANDROID_KEY_PASSWORD)

  $fileReady = $false
  if (Test-Path $Path) {
    $requiredKeys = @('storeFile', 'storePassword', 'keyAlias', 'keyPassword')
    $lines = Get-Content -Path $Path
    $present = @{}
    foreach ($key in $requiredKeys) {
      $present[$key] = $false
    }
    foreach ($line in $lines) {
      $trimmed = $line.Trim()
      if ($trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) {
        continue
      }
      $parts = $trimmed.Split('=', 2)
      $key = $parts[0].Trim()
      $value = $parts[1].Trim()
      if ($present.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($value) -and -not $value.StartsWith('YOUR_')) {
        $present[$key] = $true
      }
    }
    $fileReady = ($present.Values | Where-Object { $_ -eq $false }).Count -eq 0
  }

  return [PSCustomObject]@{
    EnvReady = $envReady
    KeyPropertiesReady = $fileReady
    HasSigning = $envReady -or $fileReady
    SigningMode = if ($envReady -or $fileReady) { 'configured_release' } else { 'fallback_debug' }
    SigningSource = if ($envReady) { 'environment' } elseif ($fileReady) { 'key.properties' } else { 'none' }
    KeyPropertiesPath = $Path
  }
}

function Get-GitMetadata {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($null -eq $git) {
    return [PSCustomObject]@{
      FullSha = 'nogit'
      ShortSha = 'nogit'
    }
  }

  $fullSha = & $git.Source rev-parse HEAD 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($fullSha)) {
    return [PSCustomObject]@{
      FullSha = 'nogit'
      ShortSha = 'nogit'
    }
  }

  $fullSha = $fullSha.Trim()
  $shortSha = if ($fullSha.Length -ge 7) { $fullSha.Substring(0, 7) } else { $fullSha }

  return [PSCustomObject]@{
    FullSha = $fullSha
    ShortSha = $shortSha
  }
}

function New-HandoffMarkdown {
  param(
    [string]$Tag,
    [string]$Version,
    [string]$BuildNumber,
    [string]$Channel,
    [string]$PilotScopeLabel,
    [string]$CommitSha,
    [string]$ShortSha,
    [string]$ApkName,
    [string]$Checksum,
    [string]$SigningMode,
    [string]$SigningSource
  )

  return @(
    '# Business Hub Mobile Local Release Handoff',
    '',
    "- Release tag: $Tag",
    "- Version: $Version",
    "- Build number: $BuildNumber",
    "- Channel: $Channel",
    "- Pilot scope: $PilotScopeLabel",
    "- Commit: $CommitSha",
    "- Short SHA: $ShortSha",
    "- APK: $ApkName",
    "- APK SHA256: $Checksum",
    "- Signing mode: $SigningMode",
    "- Signing source: $SigningSource",
    '',
    '## Operator evidence to attach',
    '',
    '- copied pilot snapshot',
    '- copied readiness signoff',
    '- copied full handoff pack',
    '- copied wave signoff pack',
    '- copied wave archive pack',
    '',
    '## Required runbooks',
    '',
    '- docs/mobile-launch-operations-runbook.md',
    '- docs/mobile-pilot-wave-signoff-pack.md',
    '- docs/mobile-pilot-wave-archive-pack.md'
  ) -join [Environment]::NewLine
}

function Resolve-ReleaseTag {
  param(
    [string]$ExplicitTag,
    [pscustomobject]$Metadata
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitTag)) {
    return $ExplicitTag.Trim()
  }

  return "mobile-v$($Metadata.MarketingVersion)"
}

$flutterExecutable = Resolve-FlutterExecutable -ExplicitRoot $FlutterRoot
$dartExecutable = Resolve-DartExecutable -FlutterExecutable $flutterExecutable
$metadata = Get-PubspecMetadata -Path $pubspecPath
$signing = Get-SigningReadiness -Path $keyPropertiesPath
$resolvedReleaseTag = Resolve-ReleaseTag -ExplicitTag $ReleaseTag -Metadata $metadata
$gitMetadata = Get-GitMetadata
$shortSha = $gitMetadata.ShortSha
$commitSha = $gitMetadata.FullSha

if ($Doctor) {
  $resolvedFlutterLabel = if ($null -ne $flutterExecutable) { $flutterExecutable } else { '<not found>' }
  $resolvedDartLabel = if ($null -ne $dartExecutable) { $dartExecutable } else { '<not found>' }
  $releaseFolder = Join-Path $repoRoot (Join-Path $ArtifactRoot $resolvedReleaseTag)

  Write-Host "Repo root: $repoRoot"
  Write-Host "Mobile app: $appDir"
  Write-Host "Resolved Flutter: $resolvedFlutterLabel"
  Write-Host "Resolved Dart: $resolvedDartLabel"
  Write-Host "Version: $($metadata.MarketingVersion)+$($metadata.BuildNumber)"
  Write-Host "Release tag: $resolvedReleaseTag"
  Write-Host "Release channel: $ReleaseChannel"
  Write-Host "Pilot scope: $PilotScope"
  Write-Host "Commit: $commitSha"
  Write-Host "Short SHA: $shortSha"
  Write-Host "Signing mode: $($signing.SigningMode)"
  Write-Host "Signing source: $($signing.SigningSource)"
  Write-Host "Key properties: $($signing.KeyPropertiesPath)"
  Write-Host "Artifact folder: $releaseFolder"

  if ($null -eq $flutterExecutable) {
    Show-ResolveHelp
    exit 1
  }

  Invoke-Checked -FilePath $flutterExecutable -Arguments @('--version') -Label 'Flutter version'
  exit 0
}

if ($null -eq $flutterExecutable) {
  Show-ResolveHelp
  exit 1
}

if (-not (Test-Path $appDir)) {
  throw "Flutter app directory not found: $appDir"
}

$envMap = @{
  'BUSINESS_HUB_RELEASE_CHANNEL' = $ReleaseChannel
  'BUSINESS_HUB_RELEASE_SHA' = $shortSha
  'BUSINESS_HUB_RELEASE_TAG' = $resolvedReleaseTag
  'BUSINESS_HUB_PILOT_SCOPE' = $PilotScope
}

Push-Location $appDir
try {
  if (-not $signing.HasSigning) {
    Write-Host ''
    Write-Host 'Warning: release signing is not configured. Local build may fall back to debug signing.' -ForegroundColor Yellow
    Write-Host "Expected key properties: $($signing.KeyPropertiesPath)" -ForegroundColor Yellow
  }

  if (-not $SkipPubGet) {
    Invoke-Checked -FilePath $flutterExecutable -Arguments @('pub', 'get') -Label 'flutter pub get'
  }

  if (-not $SkipCodegen) {
    if ($null -ne $dartExecutable) {
      Invoke-Checked -FilePath $dartExecutable -Arguments @('run', 'build_runner', 'build', '--delete-conflicting-outputs') -Label 'dart run build_runner'
    } else {
      Invoke-Checked -FilePath $flutterExecutable -Arguments @('pub', 'run', 'build_runner', 'build', '--delete-conflicting-outputs') -Label 'flutter pub run build_runner'
    }
  }

  if (-not $SkipAnalyze) {
    Invoke-Checked -FilePath $flutterExecutable -Arguments @('analyze') -Label 'flutter analyze'
  }

  if (-not $SkipTest) {
    Invoke-Checked -FilePath $flutterExecutable -Arguments @('test') -Label 'flutter test'
  }

  if (-not $SkipBuild) {
    $buildArgs = @(
      'build',
      'apk',
      '--release',
      "--dart-define=BUSINESS_HUB_RELEASE_CHANNEL=$ReleaseChannel",
      "--dart-define=BUSINESS_HUB_RELEASE_SHA=$shortSha",
      "--dart-define=BUSINESS_HUB_RELEASE_TAG=$resolvedReleaseTag",
      "--dart-define=BUSINESS_HUB_PILOT_SCOPE=$PilotScope"
    )
    Invoke-Checked -FilePath $flutterExecutable -Arguments $buildArgs -Label 'flutter build apk Release' -ExtraEnvironment $envMap
  }

  $sourceApk = Join-Path $appDir 'build\app\outputs\flutter-apk\app-release.apk'
  if (-not (Test-Path $sourceApk)) {
    throw "Release APK not found: $sourceApk"
  }

  $releaseFolder = Join-Path $repoRoot (Join-Path $ArtifactRoot $resolvedReleaseTag)
  New-Item -ItemType Directory -Force -Path $releaseFolder | Out-Null

  $apkName = "BusinessHub-Mobile-$resolvedReleaseTag.apk"
  $apkTarget = Join-Path $releaseFolder $apkName
  Copy-Item -Path $sourceApk -Destination $apkTarget -Force

  $checksum = (Get-FileHash -Path $apkTarget -Algorithm SHA256).Hash.ToLowerInvariant()
  $checksumPath = "$apkTarget.sha256"
  Set-Content -Path $checksumPath -Value "$checksum  $apkName" -Encoding utf8

  $manifestTextPath = Join-Path $releaseFolder "BusinessHub-Mobile-$resolvedReleaseTag.manifest.txt"
  $manifestJsonPath = Join-Path $releaseFolder "BusinessHub-Mobile-$resolvedReleaseTag.manifest.json"
  $handoffPath = Join-Path $releaseFolder "BusinessHub-Mobile-$resolvedReleaseTag.handoff.md"

  $manifestText = @(
    "Tag: $resolvedReleaseTag",
    "Version: $($metadata.MarketingVersion)",
    "Build: $($metadata.BuildNumber)",
    "Channel: $ReleaseChannel",
    "Pilot Scope: $PilotScope",
    "Commit: $commitSha",
    "Short SHA: $shortSha",
    "APK: $apkName",
    "SHA256: $checksum",
    "Signing Mode: $($signing.SigningMode)",
    "Signing Source: $($signing.SigningSource)",
    "Generated At (UTC): $([DateTime]::UtcNow.ToString('o'))"
  ) -join [Environment]::NewLine
  Set-Content -Path $manifestTextPath -Value $manifestText -Encoding utf8

  $manifestJson = @{
    tag = $resolvedReleaseTag
    version = $metadata.MarketingVersion
    build_number = $metadata.BuildNumber
    channel = $ReleaseChannel
    pilot_scope = $PilotScope
    commit = $commitSha
    short_sha = $shortSha
    apk_name = $apkName
    apk_sha256 = $checksum
    signing_ready = $signing.HasSigning
    signing_mode = $signing.SigningMode
    signing_source = $signing.SigningSource
    generated_at_utc = [DateTime]::UtcNow.ToString('o')
  } | ConvertTo-Json -Depth 4
  Set-Content -Path $manifestJsonPath -Value $manifestJson -Encoding utf8

  $handoffMarkdown = New-HandoffMarkdown `
    -Tag $resolvedReleaseTag `
    -Version $metadata.MarketingVersion `
    -BuildNumber $metadata.BuildNumber `
    -Channel $ReleaseChannel `
    -PilotScopeLabel $PilotScope `
    -CommitSha $commitSha `
    -ShortSha $shortSha `
    -ApkName $apkName `
    -Checksum $checksum `
    -SigningMode $signing.SigningMode `
    -SigningSource $signing.SigningSource
  Set-Content -Path $handoffPath -Value $handoffMarkdown -Encoding utf8

  Write-Host ''
  Write-Host 'Business Hub mobile local release package completed successfully.' -ForegroundColor Green
  Write-Host "Artifact folder: $releaseFolder"
  Write-Host "APK: $apkTarget"
  Write-Host "Checksum: $checksum"
} finally {
  Pop-Location
}
