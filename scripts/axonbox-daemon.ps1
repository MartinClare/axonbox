# AxonCase daemon — survives IDE/agent terminal exit; health-check + auto-restart
$ErrorActionPreference = "Continue"
$NodeDir = "C:\Users\user\AppData\Local\nodejs-portable\node-v22.17.0-win-x64"
$env:Path = "$NodeDir;" + $env:Path

$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "package.json"))) { $Root = $PSScriptRoot }
Set-Location $Root

$port = 3000
$logDir = Join-Path $Root "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir "daemon.log"
$pidFile = Join-Path $logDir "server.pid"
$lockFile = Join-Path $logDir "daemon.lock"

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

# Single daemon instance
if (Test-Path $lockFile) {
  $old = Get-Content $lockFile -ErrorAction SilentlyContinue
  if ($old -and (Get-Process -Id $old -ErrorAction SilentlyContinue)) {
    Write-Log "Another daemon already running (pid $old). Exit."
    exit 0
  }
}
Set-Content -Path $lockFile -Value $PID -Encoding ASCII

$dbFile = Join-Path $Root "prisma\dev.db"
$env:DATABASE_URL = "file:$($dbFile -replace '\\','/')"
$env:NEXTAUTH_URL = "http://localhost:$port"
$env:AUTH_TRUST_HOST = "true"
if (-not $env:NEXTAUTH_SECRET) { $env:NEXTAUTH_SECRET = "axon-case-demo-secret-change-me" }

if (-not (Test-Path $dbFile)) {
  Write-Log "DB missing — db:setup"
  npm run db:setup | Out-Null
}
if (-not (Test-Path (Join-Path $Root ".next\BUILD_ID"))) {
  Write-Log "Build missing — npm run build"
  npm run build
}

function Test-Health {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 4
    return $r.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-ListenerPids {
  @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
}

function Stop-PortHolders {
  foreach ($p in (Get-ListenerPids)) {
    if ($p) {
      Write-Log "Stopping pid $p on :$port"
      Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 1
}

function Start-Server {
  Stop-PortHolders
  $npx = Join-Path $NodeDir "npx.cmd"
  if (-not (Test-Path $npx)) { $npx = "npx" }
  Write-Log "Starting next start -H 0.0.0.0 -p $port"
  $proc = Start-Process -FilePath $npx `
    -ArgumentList @("next", "start", "-H", "0.0.0.0", "-p", "$port") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru
  if ($proc) {
    Set-Content -Path $pidFile -Value $proc.Id -Encoding ASCII
    Write-Log "Server process pid $($proc.Id)"
  }
  # Wait up to 45s for health
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Health) {
      Write-Log "Healthy on :$port"
      return $true
    }
    if ($proc -and $proc.HasExited) {
      Write-Log "Server exited early code=$($proc.ExitCode)"
      return $false
    }
  }
  Write-Log "Health timeout after start"
  return $false
}

Write-Log "Daemon started (pid $PID) root=$Root"
$failStreak = 0

try {
  while ($true) {
    if (Test-Health) {
      $failStreak = 0
    } else {
      $failStreak++
      Write-Log "Health fail #$failStreak — restarting"
      $ok = Start-Server
      if (-not $ok) {
        $wait = [Math]::Min(30, 3 + $failStreak * 2)
        Write-Log "Restart failed; sleep ${wait}s"
        Start-Sleep -Seconds $wait
      }
    }
    Start-Sleep -Seconds 12
  }
} finally {
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
  Write-Log "Daemon stopped"
}
