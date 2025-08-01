# League of Legends Patch Notifier - Release Script (PowerShell版)
# Usage: .\Scripts\release.ps1 [patch|minor|major] [-DryRun]

param(
    [ValidateSet("patch", "minor", "major")]
    [string]$ReleaseType = "patch",
    [switch]$DryRun
)

# Colors
$Red = [ConsoleColor]::Red
$Green = [ConsoleColor]::Green
$Yellow = [ConsoleColor]::Yellow
$Blue = [ConsoleColor]::Blue

Write-Host "🎮 League of Legends Patch Notifier - Release Script" -ForegroundColor $Blue
Write-Host "==================================================" -ForegroundColor $Blue

if ($DryRun) {
    Write-Host "🧪 DRY RUN MODE - No changes will be made" -ForegroundColor $Yellow
}

# Check if we're on the correct branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "⚠️  Currently on branch: $currentBranch" -ForegroundColor $Yellow
    Write-Host "⚠️  Releases should typically be made from 'main' branch" -ForegroundColor $Yellow
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -notmatch "^[Yy]$") {
        Write-Host "❌ Release cancelled" -ForegroundColor $Red
        exit 1
    }
}

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "❌ There are uncommitted changes" -ForegroundColor $Red
    Write-Host "Please commit or stash changes before releasing" -ForegroundColor $Yellow
    exit 1
}

# Get current version
$currentVersion = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "📊 Current version: $currentVersion" -ForegroundColor $Blue

# Calculate new version
$versionParts = $currentVersion.Split('.')
switch ($ReleaseType) {
    "patch" {
        $versionParts[2] = [int]$versionParts[2] + 1
    }
    "minor" {
        $versionParts[1] = [int]$versionParts[1] + 1
        $versionParts[2] = 0
    }
    "major" {
        $versionParts[0] = [int]$versionParts[0] + 1
        $versionParts[1] = 0
        $versionParts[2] = 0
    }
}
$newVersion = $versionParts -join '.'

Write-Host "🎯 New version will be: $newVersion" -ForegroundColor $Green

# Confirm release
if (-not $DryRun) {
    Write-Host "📋 Release Summary:" -ForegroundColor $Yellow
    Write-Host "  - Type: $ReleaseType"
    Write-Host "  - Current: $currentVersion"
    Write-Host "  - New: $newVersion"
    Write-Host "  - Branch: $currentBranch"
    Write-Host ""
    $proceed = Read-Host "Proceed with release? (y/N)"
    if ($proceed -notmatch "^[Yy]$") {
        Write-Host "❌ Release cancelled" -ForegroundColor $Red
        exit 1
    }
}

Write-Host "🔧 Starting release process..." -ForegroundColor $Blue

# Run pre-release checks
Write-Host "1. Running pre-release checks..." -ForegroundColor $Blue

if (-not $DryRun) {
    # Install dependencies
    Write-Host "  📦 Installing dependencies..."
    npm ci
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ npm ci failed" -ForegroundColor $Red
        exit 1 
    }

    # Run tests
    Write-Host "  🧪 Running tests..."
    npm test
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Tests failed" -ForegroundColor $Red
        exit 1 
    }

    # Type checking
    Write-Host "  🔍 Type checking..."
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Type checking failed" -ForegroundColor $Red
        exit 1 
    }

    # Linting
    Write-Host "  🔍 Linting..."
    npm run lint
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Linting failed" -ForegroundColor $Red
        exit 1 
    }

    # Build
    Write-Host "  🏗️  Building..."
    npm run build
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Build failed" -ForegroundColor $Red
        exit 1 
    }
} else {
    Write-Host "  🧪 [DRY RUN] Would run: npm ci, npm test, npm run typecheck, npm run lint, npm run build"
}

# Update version
Write-Host "2. Updating version..." -ForegroundColor $Blue
if (-not $DryRun) {
    npm version $ReleaseType --no-git-tag-version
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Version update failed" -ForegroundColor $Red
        exit 1 
    }
    Write-Host "  ✅ Version updated to $newVersion"
} else {
    Write-Host "  🧪 [DRY RUN] Would update version to $newVersion"
}

# Generate changelog entry
Write-Host "3. Generating changelog..." -ForegroundColor $Blue
$changelogEntry = @"
## [$newVersion] - $(Get-Date -Format "yyyy-MM-dd")

### Added
- New features and enhancements

### Changed
- Improvements and modifications

### Fixed
- Bug fixes and corrections

### Security
- Security improvements

"@

if (-not $DryRun) {
    if (-not (Test-Path "CHANGELOG.md")) {
        $changelogHeader = @"
# Changelog

All notable changes to this project will be documented in this file.

$changelogEntry
"@
        Set-Content -Path "CHANGELOG.md" -Value $changelogHeader -Encoding UTF8
    } else {
        $existingContent = Get-Content "CHANGELOG.md" -Encoding UTF8
        $newContent = $existingContent[0..2] + $changelogEntry.Split("`n") + $existingContent[3..($existingContent.Length-1)]
        Set-Content -Path "CHANGELOG.md" -Value $newContent -Encoding UTF8
    }
    Write-Host "  ✅ Changelog updated"
} else {
    Write-Host "  🧪 [DRY RUN] Would generate changelog entry for $newVersion"
}

# Commit changes
Write-Host "4. Committing changes..." -ForegroundColor $Blue
if (-not $DryRun) {
    git add package.json package-lock.json CHANGELOG.md
    $commitMessage = @"
chore: release v$newVersion

- パッチノート通知システムのリリース v$newVersion
- 自動リリーススクリプトによる更新

🤖 Generated with release script
"@
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Git commit failed" -ForegroundColor $Red
        exit 1 
    }
    Write-Host "  ✅ Changes committed"
} else {
    Write-Host "  🧪 [DRY RUN] Would commit version and changelog changes"
}

# Create and push tag
Write-Host "5. Creating and pushing tag..." -ForegroundColor $Blue
if (-not $DryRun) {
    $tagMessage = @"
Release v$newVersion

League of Legends Patch Notifier v$newVersion

🎮 パッチノート自動通知システム
🤖 AI要約機能付きDiscord通知
📊 堅牢な監視システム

リリース日: $(Get-Date -Format "yyyy-MM-dd")
"@
    git tag -a "v$newVersion" -m $tagMessage
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Git tag creation failed" -ForegroundColor $Red
        exit 1 
    }
    
    git push origin $currentBranch
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Git push failed" -ForegroundColor $Red
        exit 1 
    }
    
    git push origin "v$newVersion"
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ Git tag push failed" -ForegroundColor $Red
        exit 1 
    }
    Write-Host "  ✅ Tag v$newVersion created and pushed"
} else {
    Write-Host "  🧪 [DRY RUN] Would create and push tag v$newVersion"
}

# Success message
Write-Host "🎉 Release process completed successfully!" -ForegroundColor $Green
Write-Host "=================================" -ForegroundColor $Green
Write-Host "✅ Version: $newVersion" -ForegroundColor $Green
Write-Host "✅ Tag: v$newVersion" -ForegroundColor $Green
Write-Host "✅ GitHub Actions will automatically create the release" -ForegroundColor $Green

if (-not $DryRun) {
    Write-Host "📦 Release will be available at:" -ForegroundColor $Blue
    Write-Host "https://github.com/yuu1111/LoL-PatchNote-Notifier/releases/tag/v$newVersion" -ForegroundColor $Blue
    
    Write-Host "📋 Post-release checklist:" -ForegroundColor $Yellow
    Write-Host "  1. Monitor GitHub Actions for successful release build"
    Write-Host "  2. Verify release artifacts are properly generated"
    Write-Host "  3. Test the released version in a clean environment"
    Write-Host "  4. Update deployment environments if needed"
    Write-Host "  5. Announce the release to users"
} else {
    Write-Host "🧪 This was a dry run. No actual changes were made." -ForegroundColor $Yellow
}

Write-Host "🚀 Happy releasing!" -ForegroundColor $Blue