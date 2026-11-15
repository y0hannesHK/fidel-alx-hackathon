$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceVideo = Join-Path $repoRoot 'demo\media\flower.mp4'
$outputDirectory = Join-Path $repoRoot 'data\demo\qa'
if (-not (Test-Path -LiteralPath $sourceVideo -PathType Leaf)) {
    throw "The CC0 sample video is missing: $sourceVideo"
}

$null = New-Item -ItemType Directory -Force -Path $outputDirectory
$background = Join-Path $outputDirectory 'background.mp4'
$narrationPath = Join-Path $outputDirectory 'narration.wav'
$captionPath = Join-Path $outputDirectory 'captions-en.vtt'
$outputVideo = Join-Path $outputDirectory 'lesson.mp4'
Copy-Item -LiteralPath $sourceVideo -Destination $background -Force

Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synthesizer.GetInstalledVoices() |
    Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name.StartsWith('en-') } |
    Select-Object -First 1
if (-not $voice) {
    $synthesizer.Dispose()
    throw 'No enabled English Windows text-to-speech voice is installed.'
}

$captionText = 'Welcome to this short demo. Captions match the spoken narration.'
try {
    $synthesizer.SelectVoice($voice.VoiceInfo.Name)
    $synthesizer.SetOutputToWaveFile($narrationPath)
    $synthesizer.Speak($captionText)
}
finally {
    $synthesizer.Dispose()
}

$durationOutput = & docker compose exec -T server ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /app/data/demo/qa/narration.wav
if ($LASTEXITCODE -ne 0) {
    throw 'Could not measure the generated narration. Confirm the Docker server container is running.'
}
$duration = [double]::Parse(($durationOutput | Select-Object -First 1).Trim(), [Globalization.CultureInfo]::InvariantCulture)
$captionEnd = [TimeSpan]::FromMilliseconds([Math]::Ceiling($duration * 1000))
$captionEndText = $captionEnd.ToString('hh\:mm\:ss\.fff')
$vtt = "WEBVTT`n`n1`n00:00:00.000 --> $captionEndText`n$captionText`n"
[IO.File]::WriteAllText($captionPath, $vtt, [Text.UTF8Encoding]::new($false))

& docker compose exec -T server ffmpeg -hide_banner -loglevel error -y `
    -stream_loop -1 -i /app/data/demo/qa/background.mp4 `
    -i /app/data/demo/qa/narration.wav `
    -map 0:v:0 -map 1:a:0 -shortest `
    -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p `
    -c:a aac -b:a 96k -movflags +faststart `
    /app/data/demo/qa/lesson.mp4
if ($LASTEXITCODE -ne 0) {
    throw 'FFmpeg could not create the QA video.'
}

if (-not (Test-Path -LiteralPath $outputVideo -PathType Leaf) -or
    -not (Test-Path -LiteralPath $captionPath -PathType Leaf)) {
    throw 'The QA video or its matching English captions were not created.'
}

Remove-Item -LiteralPath $background, $narrationPath -Force
Write-Output "Created $outputVideo with synthetic English narration and matching captions."
