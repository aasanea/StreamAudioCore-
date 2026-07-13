# Set error action to stop
$ErrorActionPreference = "Stop"

$KeyPath = Join-Path $PSScriptRoot "streamaudio-core\~\.streamaudio-signing\streamaudio_new.key"

if (-not (Test-Path $KeyPath)) {
    Write-Error "Private key not found at $KeyPath"
}

Write-Host "Loading signing key..."
$KeyContent = Get-Content -Raw $KeyPath

# Set environment variables for this process session
$env:TAURI_SIGNING_PRIVATE_KEY = $KeyContent
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = " "

Write-Host "Starting Tauri Build..."
Set-Location (Join-Path $PSScriptRoot "streamaudio-core")
npm run tauri build
