param([switch]$Rollback)
# Saturn OS deploy: pushes built bundle and server to the VM and restarts the shell.
#   .\deploy.cmd             -> build + upload + restart
#   .\deploy.cmd -Rollback   -> restore the backup taken before the last deploy
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vm   = "saturn"   # SSH alias from ~/.ssh/config

# Sends a shell script to the VM as base64 (avoids Windows CR/LF problems).
function Run-Remote([string]$script) {
    $script = $script -replace "`r", ""
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
    ssh $vm "echo $b64 | base64 -d | sh"
}

$restart = @'
pkill -f "node server.js" || true
setsid nohup node server.js >/tmp/saturn.log 2>&1 < /dev/null &
sleep 1
pkill chromium || true
tail -3 /tmp/saturn.log || true
'@

if ($Rollback) {
    $remote = @"
set -e
cd ~/saturn-shell
b=`$(ls -dt backups/* 2>/dev/null | head -1)
[ -n "`$b" ] || { echo "no backup found"; exit 1; }
rm -rf dist server server.js public
[ -d "`$b/dist" ] && cp -r `$b/dist dist
[ -d "`$b/server" ] && cp -r `$b/server server
[ -d "`$b/public" ] && cp -r `$b/public public
cp `$b/server.js server.js
echo "restored `$b"
$restart
"@
    Write-Host "==> Rolling back..." -ForegroundColor Yellow
    Run-Remote $remote
    exit $LASTEXITCODE
}

# 1. Local Vite + Svelte 5 + TypeScript build
Write-Host "==> Building Saturn OS (npm run build)..." -ForegroundColor Cyan
Push-Location $root
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed! Fix compilation errors before deploying." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

if (-not (Test-Path "$root\dist\index.html")) { Write-Host "dist\index.html not found in $root" -ForegroundColor Red; exit 1 }
if (-not (Test-Path "$root\server.js"))       { Write-Host "server.js not found in $root" -ForegroundColor Red; exit 1 }
if (-not (Test-Path "$root\server"))          { Write-Host "server folder not found in $root" -ForegroundColor Red; exit 1 }

Write-Host "==> Uploading to VM..." -ForegroundColor Cyan
ssh $vm "rm -rf ~/saturn-incoming && mkdir -p ~/saturn-incoming"
if ($LASTEXITCODE -ne 0) { Write-Host "Cannot reach the VM. Is it running and is port forwarding 2222 on?" -ForegroundColor Red; exit 1 }

scp -r "$root\dist" "$root\server" "$root\server.js" "${vm}:~/saturn-incoming/"
if ($LASTEXITCODE -ne 0) { Write-Host "Upload failed." -ForegroundColor Red; exit 1 }

$remote = @"
set -e
cd ~/saturn-shell
t=`$(date +%Y%m%d-%H%M%S)
mkdir -p backups/`$t
cp -r dist server server.js public backups/`$t/ 2>/dev/null || true
ls -dt backups/* 2>/dev/null | tail -n +6 | xargs -r rm -rf
rm -rf dist server server.js
cp -r ~/saturn-incoming/dist dist
cp -r ~/saturn-incoming/server server
cp ~/saturn-incoming/server.js server.js
echo "backup: backups/`$t"
$restart
"@
Write-Host "==> Installing and restarting Saturn Shell..." -ForegroundColor Cyan
Run-Remote $remote
if ($LASTEXITCODE -eq 0) { Write-Host "==> Done. Look at the VM screen." -ForegroundColor Green }
