param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$SourceVideo
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = (Resolve-Path -LiteralPath $SourceVideo).Path
$outputDirectory = Join-Path $repoRoot 'data\demo\original'
$videoPath = Join-Path $outputDirectory 'lesson.mp4'
$audioPath = Join-Path $outputDirectory 'audio.wav'
$captionPath = Join-Path $outputDirectory 'captions-en.vtt'

$null = New-Item -ItemType Directory -Force -Path $outputDirectory
Copy-Item -LiteralPath $sourcePath -Destination $videoPath -Force

Push-Location $repoRoot
try {
    & docker compose exec -T server ffmpeg -hide_banner -loglevel error -y `
        -i /app/data/demo/original/lesson.mp4 -map 0:a:0 -vn `
        -ac 1 -ar 16000 -c:a pcm_s16le /app/data/demo/original/audio.wav
    if ($LASTEXITCODE -ne 0) {
        throw 'FFmpeg could not extract audio. Confirm the Docker server is running and the video contains audio.'
    }

    & docker compose exec -T server python -m app.transcribe_local `
        /app/data/demo/original/audio.wav /app/data/demo/original/captions-en.vtt
    if ($LASTEXITCODE -ne 0) {
        throw 'Local transcription did not produce English captions. The source audio and language need review.'
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $videoPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $captionPath -PathType Leaf)) {
    throw 'The original video or its English WebVTT captions are missing.'
}

Remove-Item -LiteralPath $audioPath -Force -ErrorAction SilentlyContinue
Write-Output "Prepared local test video and draft captions at $outputDirectory."
