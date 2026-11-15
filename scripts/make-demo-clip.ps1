$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceRecording = Join-Path $repoRoot 'assets\GMT20261110-160253_Recording_2426x1516.mp4'
if (-not (Test-Path -LiteralPath $sourceRecording -PathType Leaf)) {
    Write-Host 'Cannot generate the lesson clip: the authorized source recording is missing.' -ForegroundColor Red
    Write-Host "Expected file: $sourceRecording"
    Write-Host 'Obtain the recording from its owner, place it at the expected path, and rerun this script.'
    exit 1
}

$bashCandidates = @()
$git = Get-Command git.exe -ErrorAction SilentlyContinue
if ($git) {
    $gitRoot = Split-Path -Parent (Split-Path -Parent $git.Source)
    $bashCandidates += Join-Path $gitRoot 'bin\bash.exe'
}
$bashCandidates += Join-Path $env:ProgramFiles 'Git\bin\bash.exe'
$bashCandidates += Join-Path $env:LocalAppData 'Programs\Git\bin\bash.exe'
$bash = $bashCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $bash) {
    Write-Host 'Cannot run the clip generator: Git for Windows Bash was not found.' -ForegroundColor Red
    Write-Host 'Install Git for Windows, then run this script again.'
    exit 1
}

Push-Location $repoRoot
try {
    & $bash scripts/make-demo-clip.sh
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    exit $exitCode
}
