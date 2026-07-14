# StreamAudio Core - Build & Sign Release
# This script builds the Tauri app and signs the update with the project signing key.
# The signing key has NO password - this is intentional to avoid future issues.

$ErrorActionPreference = "Stop"

# --- Configuration ---
$ProjectRoot = "D:\StreamAudioCore"
$KeyPath = Join-Path $ProjectRoot "streamaudio-core\~\.streamaudio-signing\streamaudio.key"
$AppDir = Join-Path $ProjectRoot "streamaudio-core"

# --- Preflight Check ---
if (-not (Test-Path $KeyPath)) {
    Write-Error "FATAL: Private key not found at $KeyPath"
    exit 1
}

# --- Load Key ---
Write-Host ""
Write-Host "=== StreamAudio Core Build ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/3] Loading signing key..." -ForegroundColor Yellow
$KeyContent = (Get-Content -Raw $KeyPath).Trim()

# Set environment variables for Tauri
$env:TAURI_SIGNING_PRIVATE_KEY = $KeyContent
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "none"

# --- Build ---
Write-Host "[2/3] Starting Tauri build..." -ForegroundColor Yellow
Set-Location $AppDir
npm run tauri build

# --- Verify Artifacts ---
Write-Host "[3/3] Verifying build artifacts..." -ForegroundColor Yellow

$Version = (Get-Content (Join-Path $AppDir "src-tauri\tauri.conf.json") | ConvertFrom-Json).version
$NsisDir = Join-Path $AppDir "src-tauri\target\release\bundle\nsis"
$ExePath = Join-Path $NsisDir "streamaudio-core_${Version}_x64-setup.exe"
$SigPath = Join-Path $NsisDir "streamaudio-core_${Version}_x64-setup.exe.sig"
$JsonPath = Join-Path $NsisDir "latest.json"

$allGood = $true
foreach ($file in @($ExePath, $SigPath, $JsonPath)) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "  OK: $(Split-Path $file -Leaf) ($([math]::Round($size/1MB, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  MISSING: $(Split-Path $file -Leaf)" -ForegroundColor Red
        $allGood = $false
    }
}

if ($allGood) {
    Write-Host ""
    Write-Host "BUILD SUCCESSFUL! Version $Version is ready for upload." -ForegroundColor Green
    Write-Host "Artifacts location: $NsisDir" -ForegroundColor Gray
} else {
    Write-Error "BUILD FAILED: Some artifacts are missing!"
    exit 1
}

Write-Host ""
