# =============================================================
#  سكربت رفع التحديث لسيرفرات Cloudflare R2
#  يقوم بتشغيل سكربت الرفع (upload_r2.py) الذي يستخدم
#  Cloudflare API لرفع الملفات وتفريغ الكاش تلقائياً
# =============================================================

$ErrorActionPreference = "Stop"

Set-Location "D:\StreamAudioCore"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   رفع التحديث للمستخدمين" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

python "D:\StreamAudioCore\Scripts\upload_r2.py"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   اكتملت العملية!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Pause
