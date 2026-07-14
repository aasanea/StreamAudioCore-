# =============================================================
#  سكربت بناء وتوقيع تحديث StreamAudio Core
#  يقوم بتشغيل سكربت البناء الرئيسي (build-release.ps1)
# =============================================================

$ErrorActionPreference = "Stop"

Set-Location "D:\StreamAudioCore"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   بناء وتوقيع التحديث" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

.\build-release.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   اكتمل البناء بنجاح!" -ForegroundColor Green
Write-Host "   يمكنك الآن تشغيل سكربت الرفع" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Pause
