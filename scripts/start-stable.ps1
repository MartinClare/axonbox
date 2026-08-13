# AxonBox stable start — PC + phone (LAN); optional -Watch auto-restart
param(
  [switch]$Watch
)

$ErrorActionPreference = "Continue"
$env:Path = "C:\Users\user\AppData\Local\nodejs-portable\node-v22.17.0-win-x64;" + $env:Path
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "package.json"))) { $Root = $PSScriptRoot }
Set-Location $Root

$port = 3000

function Clear-Port3000 {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
}

$dbFile = Join-Path $Root "prisma\dev.db"
if (-not (Test-Path $dbFile)) {
  Write-Host "Database missing — running db:setup..."
  npm run db:setup
}

$lan = (
  Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
)
if (-not $lan) { $lan = "127.0.0.1" }

$env:DATABASE_URL = "file:$($dbFile -replace '\\','/')"
$env:NEXTAUTH_URL = "http://localhost:$port"
$env:AUTH_TRUST_HOST = "true"
if (-not $env:NEXTAUTH_SECRET) { $env:NEXTAUTH_SECRET = "axon-case-demo-secret-change-me" }

if (-not (Test-Path ".next\BUILD_ID")) {
  Write-Host "Building AxonBox..."
  npm run build
}

Write-Host ""
Write-Host "AxonBox ready:"
Write-Host "  PC:    http://localhost:$port"
Write-Host "  Phone: http://${lan}:$port   (same Wi-Fi)"
Write-Host "  App:   open /install on phone → Add to Home Screen"
Write-Host "  Guide: http://localhost:$port/open"
Write-Host "  Tip:   长期稳定请用 npm run start:daemon（后台守护，关掉终端也不死）"
if ($Watch) {
  Write-Host "  Mode:  watch (auto-restart if process exits)"
}
Write-Host ""

do {
  Clear-Port3000
  Write-Host ("[{0}] Starting next on :{1} ..." -f (Get-Date -Format "HH:mm:ss"), $port)
  npx next start -H 0.0.0.0 -p $port
  $code = $LASTEXITCODE
  Write-Host ("[{0}] Server exited (code {1})" -f (Get-Date -Format "HH:mm:ss"), $code)
  if (-not $Watch) { break }
  Write-Host "Restarting in 3s... (Ctrl+C to stop)"
  Start-Sleep -Seconds 3
} while ($true)
