@echo off
title StreamAudio Core
cd /d "%~dp0..\streamaudio-core"
npm run tauri dev
pause
