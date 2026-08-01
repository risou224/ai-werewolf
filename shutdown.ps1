# shutdown.ps1 - Clean up all project processes (process-tree mode)
$projectPath = $PSScriptRoot
$anyKilled = $false

$sep = "=" * 53
Write-Host $sep
Write-Host "   AI Werewolf - Process Cleanup"
Write-Host $sep
Write-Host ""

# ── Strategy 1: Kill by project path in command line ──
Write-Host "[1/3] Scanning processes by project path..."
$targetProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($projectPath) }

# Build a lookup of matching PIDs
$seen = [System.Collections.Generic.HashSet[int]]::new()
$treePids = [System.Collections.Generic.List[int]]::new()

foreach ($proc in $targetProcesses) {
    if ($seen.Add($proc.ProcessId)) {
        $treePids.Add($proc.ProcessId)
        Write-Host "  Found PID $($proc.ProcessId) ($($proc.Name))"
        $anyKilled = $true

        # Collect children recursively
        $queue = [System.Collections.Generic.Queue[int]]::new()
        $queue.Enqueue($proc.ProcessId)
        while ($queue.Count -gt 0) {
            $parentId = $queue.Dequeue()
            $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $parentId" -ErrorAction SilentlyContinue
            foreach ($child in $children) {
                if ($seen.Add($child.ProcessId)) {
                    $treePids.Add($child.ProcessId)
                    Write-Host "    └─ Child PID $($child.ProcessId) ($($child.Name))"
                    $queue.Enqueue($child.ProcessId)
                }
            }
        }
    }
}

# ── Strategy 2: Fallback - kill by known ports (via netstat, avoid Get-NetTCPConnection) ──
Write-Host ""
Write-Host "[2/3] Checking known ports (3001, 5173)..."
$portLines = netstat -ano | Select-String '\b(3001|5173)\b'
foreach ($line in $portLines) {
    if ($line -match 'LISTENING\s+(\d+)$') {
        $procId = [int]$Matches[1]
        if ($seen.Add($procId)) {
            $treePids.Add($procId)
            Write-Host "  Port match -> PID $procId"
            $anyKilled = $true
        }
    }
}

# ── Execute kill ──
Write-Host ""
Write-Host "[3/3] Killing $($treePids.Count) process(es)..."
foreach ($id in $treePids) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    Write-Host "  Killed PID $id"
}

# ── Final status ──
Write-Host ""
if (-not $anyKilled) {
    Write-Host "  No project processes found, everything is clean."
} else {
    $remaining = Get-Process -Id $treePids -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "  ⚠ $($remaining.Count) processes still running (may need admin rights):"
        $remaining | ForEach-Object { Write-Host "    PID $($_.Id) $($_.ProcessName)" }
    } else {
        Write-Host "  All processes killed successfully."
    }
}

Write-Host ""
Write-Host "Done."
Start-Sleep -Seconds 2
