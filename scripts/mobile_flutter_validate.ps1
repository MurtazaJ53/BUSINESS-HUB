[CmdletBinding()]
param(
  [string]$FlutterRoot,
  [ValidateSet('Debug', 'Release', 'None')]
  [string]$BuildMode = 'Debug',
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
    [string]$Label
  )

  Write-Host ''
  Write-Host "==> $Label" -ForegroundColor Cyan
  Write-Host "$FilePath $($Arguments -join ' ')" -ForegroundColor DarkGray

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
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

$flutterExecutable = Resolve-FlutterExecutable -ExplicitRoot $FlutterRoot
$dartExecutable = Resolve-DartExecutable -FlutterExecutable $flutterExecutable

if ($Doctor) {
  $resolvedFlutterLabel = if ($null -ne $flutterExecutable) {
    $flutterExecutable
  } else {
    '<not found>'
  }
  $resolvedDartLabel = if ($null -ne $dartExecutable) {
    $dartExecutable
  } else {
    '<not found>'
  }

  Write-Host "Repo root: $repoRoot"
  Write-Host "Mobile app: $appDir"
  Write-Host "Resolved Flutter: $resolvedFlutterLabel"
  Write-Host "Resolved Dart: $resolvedDartLabel"

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

Push-Location $appDir
try {
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

  if (-not $SkipBuild -and $BuildMode -ne 'None') {
    $buildFlag = if ($BuildMode -eq 'Release') { '--release' } else { '--debug' }
    Invoke-Checked -FilePath $flutterExecutable -Arguments @('build', 'apk', $buildFlag) -Label "flutter build apk $BuildMode"
  }

  Write-Host ''
  Write-Host 'Business Hub mobile validation completed successfully.' -ForegroundColor Green
} finally {
  Pop-Location
}
