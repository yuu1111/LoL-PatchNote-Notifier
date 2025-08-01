# LoL Patch Notifier プロセス終了スクリプト
Write-Host "LoL Patch Notifier 関連プロセスを検索中..." -ForegroundColor Yellow

# 現在のディレクトリを取得
$currentDir = Get-Location

# Node.js プロセス一覧取得
$nodeProcesses = Get-WmiObject Win32_Process | Where-Object { $_.Name -eq "node.exe" }

Write-Host "`n実行中の Node.js プロセス:" -ForegroundColor Cyan
$nodeProcesses | ForEach-Object {
    Write-Host "PID: $($_.ProcessId) - $($_.CommandLine)" -ForegroundColor Gray
}

# LoLPatchNotifier関連プロセスを特定
$lolPatchNotifierProcesses = @()

foreach ($process in $nodeProcesses) {
    $cmdLine = $process.CommandLine

    # LoLPatchNotifier関連の条件をチェック
    $isLoLPatchNotifier = $false

    if ($cmdLine -match "lol-patch-notifier|LoL-Patch-Notifier" -or
        $cmdLine -match "npm run dev" -and $cmdLine -match [regex]::Escape($currentDir) -or
        $cmdLine -match "tsx watch" -and $cmdLine -match [regex]::Escape($currentDir) -or
        $cmdLine -match "patch.*notifier" -and $cmdLine -match [regex]::Escape($currentDir) -or
        $cmdLine -match "app\.ts" -and $cmdLine -match [regex]::Escape($currentDir)) {
        $isLoLPatchNotifier = $true
    }

    if ($isLoLPatchNotifier) {
        $lolPatchNotifierProcesses += $process
        Write-Host "`nLoL Patch Notifier関連プロセス発見:" -ForegroundColor Green
        Write-Host "PID: $($process.ProcessId)" -ForegroundColor Yellow
        Write-Host "Command: $($process.CommandLine)" -ForegroundColor Gray
    }
}

if ($lolPatchNotifierProcesses.Count -eq 0) {
    Write-Host "`nLoL Patch Notifier関連のプロセスは見つかりませんでした。" -ForegroundColor Green
    Write-Host "手動で確認したい場合は、以下のコマンドを実行してください:" -ForegroundColor Yellow
    Write-Host "Get-Process node | Where-Object { `$_.ProcessName -eq 'node' }" -ForegroundColor Cyan
} else {
    Write-Host "`n$($lolPatchNotifierProcesses.Count) 個のLoL Patch Notifier関連プロセスが見つかりました。" -ForegroundColor Yellow

    $confirm = Read-Host "`nこれらのプロセスを終了しますか? (y/n)"

    if ($confirm -eq "y" -or $confirm -eq "Y") {
        foreach ($process in $lolPatchNotifierProcesses) {
            try {
                Write-Host "プロセス $($process.ProcessId) を終了中..." -ForegroundColor Yellow
                Stop-Process -Id $process.ProcessId -Force
                Write-Host "プロセス $($process.ProcessId) を終了しました。" -ForegroundColor Green
            }
            catch {
                Write-Host "プロセス $($process.ProcessId) の終了に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
            }
        }

        # 少し待機してから状態を確認
        Start-Sleep -Seconds 2

        # ログファイルやロックファイルなどの追加クリーンアップ（必要に応じて）
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

    } else {
        Write-Host "プロセス終了をキャンセルしました。" -ForegroundColor Yellow
    }
}

# 最終確認
Write-Host "`n現在実行中のNode.jsプロセス:" -ForegroundColor Cyan
$remainingProcesses = Get-WmiObject Win32_Process | Where-Object { $_.Name -eq "node.exe" }
if ($remainingProcesses.Count -eq 0) {
    Write-Host "Node.jsプロセスは実行されていません。" -ForegroundColor Green
} else {
    $remainingProcesses | ForEach-Object {
        Write-Host "PID: $($_.ProcessId) - $($_.CommandLine)" -ForegroundColor Gray
    }
}

Write-Host "`n🎮 LoL Patch Notifier プロセス終了処理完了。" -ForegroundColor Green