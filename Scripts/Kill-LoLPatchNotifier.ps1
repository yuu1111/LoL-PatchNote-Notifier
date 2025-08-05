# LoL Patch Notifier プロセス終了スクリプト
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# パラメータの処理
$Force = $false
if ($args -contains "-Force") {
    $Force = $true
}

Write-Host "LoL Patch Notifier 関連プロセスを検索中..." -ForegroundColor Yellow

# 現在のディレクトリを取得
$currentDir = Get-Location

# Node.js プロセス一覧取得
$nodeProcesses = Get-WmiObject Win32_Process | Where-Object { $_.Name -eq "node.exe" }

if ($nodeProcesses) {
    Write-Host "`n実行中の Node.js プロセス:" -ForegroundColor Cyan
    $nodeProcesses | ForEach-Object {
        $cmdLine = if ($_.CommandLine) { $_.CommandLine } else { "N/A" }
        Write-Host "PID: $($_.ProcessId) - $cmdLine" -ForegroundColor Gray
    }
} else {
    Write-Host "`nNode.js プロセスは実行されていません。" -ForegroundColor Green
    exit 0
}

# LoL Patch Notifier関連プロセスを特定
$lolPatchNotifierProcesses = @()

foreach ($process in $nodeProcesses) {
    $cmdLine = $process.CommandLine
    
    if (-not $cmdLine) {
        continue
    }
    
    # LoL Patch Notifier関連の条件をチェック
    $isLoLPatchNotifier = $false
    
    # より厳密な条件チェック
    if ($cmdLine -match "LoL-Patch-Notifier" -or 
        ($cmdLine -match "tsx" -and $cmdLine -match "watch" -and $cmdLine -match "src[/\\]app\.ts") -or
        ($cmdLine -match "tsx" -and $cmdLine -match "dist[/\\]app\.js") -or
        ($cmdLine -match "node" -and $cmdLine -match "dist[/\\]app\.js") -or
        ($cmdLine -match "node_modules[/\\]tsx[/\\]dist[/\\]preflight\.cjs" -and $cmdLine -match "src[/\\]app\.ts")) {
        $isLoLPatchNotifier = $true
    }
    
    if ($isLoLPatchNotifier) {
        $lolPatchNotifierProcesses += $process
        Write-Host "`nLoL Patch Notifier関連プロセス発見:" -ForegroundColor Green
        Write-Host "PID: $($process.ProcessId)" -ForegroundColor Yellow
        Write-Host "Command: $cmdLine" -ForegroundColor Gray
    }
}

if ($lolPatchNotifierProcesses.Count -eq 0) {
    Write-Host "`nLoL Patch Notifier関連のプロセスは見つかりませんでした。" -ForegroundColor Green
    Write-Host "手動で確認したい場合は、以下のコマンドを実行してください:" -ForegroundColor Yellow
    Write-Host "Get-Process node | Select-Object Id, ProcessName, MainWindowTitle" -ForegroundColor Cyan
} else {
    Write-Host "`n$($lolPatchNotifierProcesses.Count) 個のLoL Patch Notifier関連プロセスが見つかりました。" -ForegroundColor Yellow
    
    $confirm = "n"
    if ($Force) {
        $confirm = "y"
        Write-Host "Force オプションが指定されているため、自動的に終了します。" -ForegroundColor Cyan
    } else {
        $confirm = Read-Host "`nこれらのプロセスを終了しますか? (y/n)"
    }
    
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        $successCount = 0
        $failCount = 0
        
        foreach ($process in $lolPatchNotifierProcesses) {
            try {
                Write-Host "プロセス $($process.ProcessId) を終了中..." -ForegroundColor Yellow
                Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
                $successCount++
                Write-Host "プロセス $($process.ProcessId) を終了しました。" -ForegroundColor Green
            }
            catch {
                $failCount++
                Write-Host "プロセス $($process.ProcessId) の終了に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        
        # 少し待機してから状態を確認
        Start-Sleep -Seconds 2
        
        # 結果サマリー
        if ($successCount -gt 0) {
            Write-Host "`n✅ $successCount 個のプロセスを正常に終了しました。" -ForegroundColor Green
        }
        if ($failCount -gt 0) {
            Write-Host "❌ $failCount 個のプロセスの終了に失敗しました。" -ForegroundColor Red
        }
        
        # ログファイルやロックファイルなどの追加クリーンアップ
        Write-Host "`n追加のクリーンアップを実行中..." -ForegroundColor Yellow
        
        # patches/last_patch_status.json の実行状態を停止に変更
        $statusFile = Join-Path $currentDir "patches\last_patch_status.json"
        if (Test-Path $statusFile) {
            try {
                $statusContent = Get-Content $statusFile -Raw | ConvertFrom-Json
                $statusContent.isRunning = $false
                $statusContent | ConvertTo-Json -Depth 10 | Set-Content $statusFile -Encoding UTF8
                Write-Host "アプリケーション状態を停止に更新しました。" -ForegroundColor Green
            }
            catch {
                Write-Host "状態ファイルの更新に失敗しました: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        
        # ロックファイルのクリーンアップ
        $lockFiles = @()
        $lockFiles += Join-Path $currentDir "*.lock"
        $lockFiles += Join-Path $currentDir "patches\*.lock"
        
        $cleanupCount = 0
        foreach ($pattern in $lockFiles) {
            $files = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
            if ($files) {
                foreach ($file in $files) {
                    try {
                        Remove-Item $file -Force -ErrorAction Stop
                        $cleanupCount++
                        Write-Host "ロックファイルを削除しました: $($file.Name)" -ForegroundColor Green
                    }
                    catch {
                        Write-Host "ロックファイルの削除に失敗しました: $($file.Name)" -ForegroundColor Yellow
                    }
                }
            }
        }
        
        if ($cleanupCount -eq 0) {
            Write-Host "クリーンアップが必要なファイルはありませんでした。" -ForegroundColor Cyan
        }
        
    } else {
        Write-Host "プロセス終了をキャンセルしました。" -ForegroundColor Yellow
    }
}

# 最終確認
Write-Host "`n最終確認中..." -ForegroundColor Cyan
$remainingBotProcesses = @()
$remainingProcesses = Get-WmiObject Win32_Process | Where-Object { $_.Name -eq "node.exe" }

if ($remainingProcesses) {
    foreach ($process in $remainingProcesses) {
        $cmdLine = $process.CommandLine
        if ($cmdLine -and ($cmdLine -match "LoL-Patch-Notifier" -or 
            ($cmdLine -match "tsx" -and $cmdLine -match "src[/\\]app\.ts") -or
            ($cmdLine -match "node" -and $cmdLine -match "dist[/\\]app\.js"))) {
            $remainingBotProcesses += $process
        }
    }
}

if ($remainingBotProcesses.Count -gt 0) {
    Write-Host "`n⚠️  まだ $($remainingBotProcesses.Count) 個のLoL Patch Notifier関連プロセスが実行中です。" -ForegroundColor Yellow
    Write-Host "強制終了するには以下のコマンドを実行してください:" -ForegroundColor Yellow
    Write-Host "npm run kill -- -Force" -ForegroundColor Cyan
} else {
    Write-Host "`n✅ LoL Patch Notifier関連のプロセスはすべて終了しました。" -ForegroundColor Green
}

Write-Host "`n🎮 LoL Patch Notifier プロセス終了処理完了。" -ForegroundColor Green
Write-Host "`nNotifierを再起動するには以下のコマンドを実行してください:" -ForegroundColor Yellow
Write-Host "  開発環境: npm run dev" -ForegroundColor Cyan
Write-Host "  本番環境: npm start" -ForegroundColor Cyan