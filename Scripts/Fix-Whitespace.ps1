# 末尾空白文字を一括削除

param(
    [string]$Path = ".",
    [string[]]$IncludeFileTypes = @("*.config",
    "*.ts",
    "*.yml",
    "*.md",
    "*.ps1",
    "*.bat",
    "*.json"),
    [string[]]$ExcludePaths = @()
)

# プロジェクトルートに移動
Set-Location $PSScriptRoot\..

Write-Host "末尾空白文字の削除を開始します..."
Write-Host "対象パス: $Path"
Write-Host "対象ファイル: $($IncludeFileTypes -join ', ')"

$totalFixed = 0

foreach ($fileType in $IncludeFileTypes) {
    Write-Host "`n処理中: $fileType"

    $files = Get-ChildItem -Path $Path -Recurse -Include $fileType | Where-Object {
        $exclude = $false
        foreach ($excludePath in $ExcludePaths) {
            if ($_.FullName -like "*$excludePath*") {
                $exclude = $true
                break
            }
        }
        -not $exclude
    }

    $fileCount = 0
    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw
        if ($content) {
            $cleaned = $content -replace '[ \t]+(?=\r?\n)', ''
            if ($content -ne $cleaned) {
                Set-Content $file.FullName -Value $cleaned -NoNewline
                Write-Host "  Fixed: $($file.Name)"
                $fileCount++
                $totalFixed++
            }
        }
    }

    if ($fileCount -eq 0) {
        Write-Host "  変更なし"
    } else {
        Write-Host "  $fileCount 件のファイルを修正"
    }
}

Write-Host "`n完了: 合計 $totalFixed 件のファイルの末尾空白文字を削除しました"