# Launch AxonCase daemon detached (does not die when this shell closes)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "package.json"))) { $Root = $PSScriptRoot }
$daemon = Join-Path $PSScriptRoot "axonbox-daemon.ps1"
$logDir = Join-Path $Root "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# Stop previous daemon if lock exists but process dead; kill old daemon by lock
$lockFile = Join-Path $logDir "daemon.lock"
if (Test-Path $lockFile) {
  $old = Get-Content $lockFile -ErrorAction SilentlyContinue
  if ($old) {
    Stop-Process -Id $old -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

$proc = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-WindowStyle", "Hidden",
    "-File", $daemon
  ) `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -PassThru

Write-Host "AxonCase daemon launched (powershell pid $($proc.Id))"
Write-Host "  PC:    http://localhost:3000"
Write-Host "  Log:   $logDir\daemon.log"
Write-Host "  Stop:  npm run stop:daemon"

# Brief wait + health probe
Start-Sleep -Seconds 8
try {
  $h = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 5
  Write-Host "  Health: $($h.Content)"
} catch {
  Write-Host "  Health: starting… (check logs if still down after 30s)"
}
