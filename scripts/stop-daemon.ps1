# Stop AxonCase daemon + server on port 3000
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "package.json"))) { $Root = $PSScriptRoot }
$logDir = Join-Path $Root "logs"
$lockFile = Join-Path $logDir "daemon.lock"
$pidFile = Join-Path $logDir "server.pid"

if (Test-Path $lockFile) {
  $d = Get-Content $lockFile -ErrorAction SilentlyContinue
  if ($d) { Stop-Process -Id $d -Force -ErrorAction SilentlyContinue }
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
if (Test-Path $pidFile) {
  $s = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($s) { Stop-Process -Id $s -Force -ErrorAction SilentlyContinue }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host "AxonCase daemon/server stopped."
