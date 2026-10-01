<#
.SYNOPSIS
  Registers (or re-registers) the StarVelocity collector as a Windows scheduled task.

.DESCRIPTION
  Runs the full collector cycle twice a day. Two runs mean a failed or
  rate-limited run gets a second chance to land a row for that UTC day.

  This is the local alternative to the GitHub Actions workflow. Use one or the
  other, not both against the same database.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1
  powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Unregister
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'StarVelocity Collector',
  [string[]]$Times  = @('09:10', '21:10'),
  [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir      = Join-Path $projectRoot 'logs'

if ($Unregister) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'."
  } else {
    Write-Host "No scheduled task named '$TaskName' found."
  }
  return
}

# Fail early rather than registering a task that cannot possibly work.
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node was not found on PATH. Install Node.js 22.18 or newer.' }

$nodeVersion = (& $node --version).TrimStart('v')
$major, $minor = $nodeVersion.Split('.')[0..1] | ForEach-Object { [int]$_ }
if ($major -lt 22 -or ($major -eq 22 -and $minor -lt 18)) {
  throw "Node $nodeVersion is too old: running TypeScript directly needs 22.18 or newer."
}

$envFile = Join-Path $projectRoot '.env'
if (-not (Test-Path $envFile)) {
  throw "No .env at $envFile. Copy .env.example to .env and set GITHUB_TOKEN first."
}
if (-not (Select-String -Path $envFile -Pattern '^\s*GITHUB_TOKEN\s*=\s*\S' -Quiet)) {
  throw "GITHUB_TOKEN is empty in $envFile. The collector cannot run without a token."
}

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# cmd.exe wrapper so stdout and stderr can be appended to a dated log file.
$logPath = Join-Path $logDir 'collect.log'
$command = "`"$node`" --disable-warning=ExperimentalWarning src\cli.ts run >> `"$logPath`" 2>&1"

$action = New-ScheduledTaskAction -Execute 'cmd.exe' `
  -Argument "/c $command" `
  -WorkingDirectory $projectRoot

$triggers = foreach ($t in $Times) { New-ScheduledTaskTrigger -Daily -At $t }

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBatteries `
  -AllowStartIfOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Replacing existing task '$TaskName'."
}

Register-ScheduledTask -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Description 'Collects GitHub repo metrics and computes star velocity.' | Out-Null

Write-Host ""
Write-Host "Registered '$TaskName'"
Write-Host "  runs at    : $($Times -join ', ') local time, daily"
Write-Host "  working dir: $projectRoot"
Write-Host "  log        : $logPath"
Write-Host ""
Write-Host "Run it now with:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Check status with: Get-ScheduledTaskInfo -TaskName '$TaskName'"
