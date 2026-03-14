# Kill any process using port 3000 and any Node processes, remove Next.js dev lock, then start next dev.
# Run with: npm run dev (package.json "dev" script invokes this on Windows).

$ErrorActionPreference = 'SilentlyContinue'

# Free port 3000
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

# Stop all Node processes (stops any existing next dev holding the lock)
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

# Remove dev lock so the new instance can start
$lockPath = Join-Path $PSScriptRoot '..' '.next' 'dev' 'lock'
if (Test-Path $lockPath) {
  Remove-Item $lockPath -Force
}

# Start next dev (replace current process so Ctrl+C works)
Set-Location (Join-Path $PSScriptRoot '..')
& npx next dev
