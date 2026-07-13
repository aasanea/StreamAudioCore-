Write-Host "Starting StreamAudio Core Development Environment..." -ForegroundColor Cyan

# Fallback to current directory if run interactively
$ScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
$ProjectDir = Join-Path $ScriptRoot "streamaudio-core"

# Navigate to the project directory
Set-Location -Path $ProjectDir

# Launch the Tauri dev server
npm run tauri dev
