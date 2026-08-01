param()

$projectPath = $PSScriptRoot
$logDir = Join-Path $projectPath "logs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

# 清理旧日志
Remove-Item (Join-Path $logDir "*.log") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $logDir "*.err") -ErrorAction SilentlyContinue

Clear-Host
Write-Host "============================================="
Write-Host "        AI Werewolf  -  One Click Start      "
Write-Host "============================================="
Write-Host ""

# ===== 启动前清理：杀干净残留进程，确保端口可用 =====
Write-Host "[0/2] Cleaning residual processes..."
$any = $false
try {
    # 策略1: 按项目路径扫 node/cmd 进程树
    $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($projectPath) }
    $seenPids = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($p in $procs) {
        $queue = [System.Collections.Generic.Queue[int]]::new()
        $queue.Enqueue($p.ProcessId)
    while ($queue.Count -gt 0) {
        $id = $queue.Dequeue()
        if (-not $seenPids.Add($id)) { continue }
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        $any = $true
        Get-CimInstance Win32_Process -Filter "ParentProcessId = $id" -ErrorAction SilentlyContinue |
            ForEach-Object { $queue.Enqueue($_.ProcessId) }
    }
}
# 策略2: 端口兜底（用 netstat 解析，避免 Get-NetTCPConnection 兼容性问题）
$portLines = netstat -ano | Select-String '\b(3001|5173)\b'
foreach ($line in $portLines) {
    if ($line -match 'LISTENING\s+(\d+)$') {
        $id = [int]$Matches[1]
        if ($seenPids.Add($id)) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; $any = $true }
    }
    }
} catch {
    Write-Host "       [WARN] Cleanup encountered non-fatal error, continuing..." -ForegroundColor Yellow
}
if ($any) { Write-Host "       [OK] Residual processes cleaned" }
else { Write-Host "       [OK] No residual processes found" }
Start-Sleep -Seconds 1

# 启动后端 (新窗口，输出到 logs/)
Write-Host "[1/2] Starting backend..."
$serverLog = Join-Path $logDir "backend.log"
$serverCmd = '/c title AI-Werewolf-Backend & cd /d "' + $projectPath + '" & npm run dev:server > "' + $serverLog + '" 2>&1'
$serverProc = Start-Process -FilePath "cmd" -ArgumentList $serverCmd `
    -WindowStyle Minimized -PassThru

# 等待后端就绪（带端口探测 + IPv4/IPv6 兼容）
Write-Host "      Waiting for backend..."
$backendPort = $null
$ready = $false
for ($i = 0; $i -lt 30; $i += 2) {
    # 先看 server 实际监听了哪个端口（支持自动 fallback 到 3002/3003...）
    $portLines = netstat -an | Select-String ':\s*(300[0-9])\s.*LISTENING'
    foreach ($line in $portLines) {
        if ($line -match ':\s*(300[0-9])\s') {
            $candidate = [int]$Matches[1]
            $urls = @("http://127.0.0.1:$candidate", "http://[::1]:$candidate")
            foreach ($u in $urls) {
                try {
                    $r = Invoke-WebRequest -Uri "$u/api/health" -UseBasicParsing -TimeoutSec 2
                    if ($r.StatusCode -eq 200) { $backendPort = $candidate; $ready = $true; break }
                } catch {}
            }
            if ($ready) { break }
        }
    }
    if ($ready) { break }
    Start-Sleep -Seconds 2
}
if ($ready) { Write-Host "       [OK] Backend ready (port $backendPort)" }
else {
    Write-Host "       [WARN] Backend startup timeout" -ForegroundColor Yellow
    Write-Host "             Check: $serverLog" -ForegroundColor Yellow
    Start-Sleep 2
}

# 启动前端
Write-Host "[2/2] Starting frontend..."
$clientLog = Join-Path $logDir "frontend.log"
$clientCmd = '/c title AI-Werewolf-Frontend & cd /d "' + $projectPath + '" & npm run dev:client > "' + $clientLog + '" 2>&1'
$clientProc = Start-Process -FilePath "cmd" -ArgumentList $clientCmd `
    -WindowStyle Minimized -PassThru

Write-Host "      Waiting for frontend..."
$frontendPort = $null
for ($i = 0; $i -lt 30; $i += 2) {
    # vite 默认只监听 IPv6 [::1]，脚本需要兼容两种情况
    $portLines = netstat -an | Select-String ':\s*(517[0-9])\s.*LISTENING'
    foreach ($line in $portLines) {
        if ($line -match ':\s*(517[0-9])\s') {
            $candidate = [int]$Matches[1]
            # 同时尝试 IPv4 和 IPv6
            $urls = @("http://127.0.0.1:$candidate", "http://[::1]:$candidate")
            foreach ($u in $urls) {
                try {
                    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2
                    if ($r.StatusCode -eq 200) { $frontendPort = $candidate; break }
                } catch {}
            }
            if ($frontendPort) { break }
        }
    }
    if ($frontendPort) { break }
    Start-Sleep -Seconds 2
}
if ($frontendPort) { Write-Host "       [OK] Frontend ready (port $frontendPort)" }
else { Write-Host "       [WARN] Frontend startup timeout" -ForegroundColor Yellow }

# 打开浏览器 — 只弹一次（去重，因为前端页面跳转会自动）
$url = "http://localhost:$frontendPort/admin/models"
Start-Process $url

Clear-Host
Write-Host "============================================="
Write-Host "        AI Werewolf  -  Running             "
Write-Host "---------------------------------------------"
Write-Host "                                             "
Write-Host "   Watch:   http://localhost:$frontendPort            "
Write-Host "   Admin:   http://localhost:$frontendPort/admin      "
Write-Host "   API:     http://localhost:$backendPort/health      "
Write-Host "                                             "
Write-Host "   Logs:    $logDir"
Write-Host "                                             "
Write-Host "   [!] Close this window = kill all services"
Write-Host "                                             "
Write-Host "============================================="
Write-Host ""

# ===== 进程生命周期管理 =====
function Kill-ProcessTree {
    param([int]$RootPid)
    $seen = [System.Collections.Generic.HashSet[int]]::new()
    $queue = [System.Collections.Generic.Queue[int]]::new()
    $queue.Enqueue($RootPid)
    while ($queue.Count -gt 0) {
        $id = $queue.Dequeue()
        if (-not $seen.Add($id)) { continue }
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        Get-CimInstance Win32_Process -Filter "ParentProcessId = $id" -ErrorAction SilentlyContinue | ForEach-Object {
            $queue.Enqueue($_.ProcessId)
        }
    }
}

$cleanup = {
    Write-Host ""
    Write-Host "Shutting down all services..."
    @($serverProc.Id, $clientProc.Id) | Where-Object { $_ } | ForEach-Object {
        Kill-ProcessTree $_
    }
    Write-Host "All services stopped."
}

try {
    # 注册退出事件
    Register-EngineEvent -SourceIdentifier PowerShell.Exiting -SupportEvent -Action $cleanup | Out-Null

    # 主循环：检测子进程存活
    while ($true) {
        Start-Sleep -Seconds 3

        $sAlive = $serverProc.Id -and (Get-Process -Id $serverProc.Id -ErrorAction SilentlyContinue)
        $cAlive = $clientProc.Id -and (Get-Process -Id $clientProc.Id -ErrorAction SilentlyContinue)

        # 如果两个都挂了，自动退出
        if (-not $sAlive -and -not $cAlive) {
            Write-Host "All services stopped, auto-exiting..."
            break
        }

        # 如果一个挂了，提示但继续
        if (-not $sAlive) { Write-Host "[WARN] Backend stopped" -ForegroundColor Yellow }
        if (-not $cAlive) { Write-Host "[WARN] Frontend stopped" -ForegroundColor Yellow }
    }
}
finally {
    # 无论什么原因退出，都执行清理
    & $cleanup
}
