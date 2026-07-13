param (
    [Parameter(Mandatory=$true)][string]$Version,
    [Parameter(Mandatory=$true)][string]$NsisZipPath,
    [Parameter(Mandatory=$true)][string]$NsisSigPath
)

$ErrorActionPreference = "Stop"

$env:CLOUDFLARE_ACCOUNT_ID = "bb412fd529888198c7f77d4e3652d091"
$env:CLOUDFLARE_API_TOKEN = "<YOUR_CLOUDFLARE_API_TOKEN>"

$BucketName = "streamaudio-updates"
$Notes = "General updates and improvements."
$PubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$ZipFileName = Split-Path $NsisZipPath -Leaf
$SigFileName = Split-Path $NsisSigPath -Leaf
$SigContent = Get-Content $NsisSigPath -Raw

$ManifestObj = @{
    version = $Version
    notes = $Notes
    pub_date = $PubDate
    platforms = @{
        "windows-x86_64" = @{
            signature = $SigContent.Trim()
            url = "https://updates.aasanea.com/releases/$ZipFileName"
        }
    }
}
$Manifest = $ManifestObj | ConvertTo-Json -Depth 5

$ManifestPath = Join-Path $env:TEMP "latest.json"
Set-Content -Path $ManifestPath -Value $Manifest -Encoding UTF8

Write-Host "Uploading $ZipFileName to R2..."
npx wrangler r2 object put "$BucketName/releases/$ZipFileName" --file $NsisZipPath --remote

Write-Host "Uploading $SigFileName to R2..."
npx wrangler r2 object put "$BucketName/releases/$SigFileName" --file $NsisSigPath --remote

Write-Host "Uploading latest.json to R2..."
npx wrangler r2 object put "$BucketName/releases/latest.json" --file $ManifestPath --content-type "application/json" --remote


Remove-Item $ManifestPath -ErrorAction SilentlyContinue

Write-Host "v$Version published!"
