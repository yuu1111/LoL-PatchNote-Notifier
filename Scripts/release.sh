#!/bin/bash

# League of Legends Patch Notifier - Release Script
# Usage: ./Scripts/release.sh [patch|minor|major] [--dry-run]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
RELEASE_TYPE=${1:-patch}
DRY_RUN=false

# Check for dry-run flag
if [[ "$2" == "--dry-run" || "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    RELEASE_TYPE=${1:-patch}
    if [[ "$1" == "--dry-run" ]]; then
        RELEASE_TYPE="patch"
    fi
fi

echo -e "${BLUE}🎮 League of Legends Patch Notifier - Release Script${NC}"
echo -e "${BLUE}===================================================${NC}"

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}❌ Invalid release type: $RELEASE_TYPE${NC}"
    echo -e "${YELLOW}Valid types: patch, minor, major${NC}"
    exit 1
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}🧪 DRY RUN MODE - No changes will be made${NC}"
fi

# Check if we're on the correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${YELLOW}⚠️  Currently on branch: $CURRENT_BRANCH${NC}"
    echo -e "${YELLOW}⚠️  Releases should typically be made from 'main' branch${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Release cancelled${NC}"
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ There are uncommitted changes${NC}"
    echo -e "${YELLOW}Please commit or stash changes before releasing${NC}"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}📊 Current version: $CURRENT_VERSION${NC}"

# Calculate new version
case $RELEASE_TYPE in
    patch)
        NEW_VERSION=$(node -p "
            const ver = require('./package.json').version.split('.');
            ver[2] = parseInt(ver[2]) + 1;
            ver.join('.');
        ")
        ;;
    minor)
        NEW_VERSION=$(node -p "
            const ver = require('./package.json').version.split('.');
            ver[1] = parseInt(ver[1]) + 1;
            ver[2] = 0;
            ver.join('.');
        ")
        ;;
    major)
        NEW_VERSION=$(node -p "
            const ver = require('./package.json').version.split('.');
            ver[0] = parseInt(ver[0]) + 1;
            ver[1] = 0;
            ver[2] = 0;
            ver.join('.');
        ")
        ;;
esac

echo -e "${GREEN}🎯 New version will be: $NEW_VERSION${NC}"

# Confirm release
if [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}📋 Release Summary:${NC}"
    echo -e "  - Type: $RELEASE_TYPE"
    echo -e "  - Current: $CURRENT_VERSION"
    echo -e "  - New: $NEW_VERSION"
    echo -e "  - Branch: $CURRENT_BRANCH"
    echo
    read -p "Proceed with release? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Release cancelled${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}🔧 Starting release process...${NC}"

# Run pre-release checks
echo -e "${BLUE}1. Running pre-release checks...${NC}"

if [ "$DRY_RUN" = false ]; then
    # Install dependencies
    echo "  📦 Installing dependencies..."
    npm ci

    # Run tests
    echo "  🧪 Running tests..."
    npm test

    # Type checking
    echo "  🔍 Type checking..."
    npm run typecheck

    # Linting
    echo "  🔍 Linting..."
    npm run lint

    # Build
    echo "  🏗️  Building..."
    npm run build
else
    echo "  🧪 [DRY RUN] Would run: npm ci, npm test, npm run typecheck, npm run lint, npm run build"
fi

# Update version
echo -e "${BLUE}2. Updating version...${NC}"
if [ "$DRY_RUN" = false ]; then
    npm version $RELEASE_TYPE --no-git-tag-version
    echo "  ✅ Version updated to $NEW_VERSION"
else
    echo "  🧪 [DRY RUN] Would update version to $NEW_VERSION"
fi

# Generate changelog entry
echo -e "${BLUE}3. Generating changelog...${NC}"
CHANGELOG_ENTRY="## [$NEW_VERSION] - $(date +%Y-%m-%d)

### Added
- New features and enhancements

### Changed
- Improvements and modifications

### Fixed
- Bug fixes and corrections

### Security
- Security improvements
"

if [ "$DRY_RUN" = false ]; then
    if [ ! -f "CHANGELOG.md" ]; then
        echo "# Changelog

All notable changes to this project will be documented in this file.

$CHANGELOG_ENTRY" > CHANGELOG.md
    else
        # Add new entry after the header
        sed -i.bak "3i\\
$CHANGELOG_ENTRY\\
" CHANGELOG.md && rm CHANGELOG.md.bak
    fi
    echo "  ✅ Changelog updated"
else
    echo "  🧪 [DRY RUN] Would generate changelog entry for $NEW_VERSION"
fi

# Commit changes
echo -e "${BLUE}4. Committing changes...${NC}"
if [ "$DRY_RUN" = false ]; then
    git add package.json package-lock.json CHANGELOG.md
    git commit -m "chore: release v$NEW_VERSION

- パッチノート通知システムのリリース v$NEW_VERSION
- 自動リリーススクリプトによる更新

🤖 Generated with release script"
    echo "  ✅ Changes committed"
else
    echo "  🧪 [DRY RUN] Would commit version and changelog changes"
fi

# Create and push tag
echo -e "${BLUE}5. Creating and pushing tag...${NC}"
if [ "$DRY_RUN" = false ]; then
    git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

League of Legends Patch Notifier v$NEW_VERSION

🎮 パッチノート自動通知システム
🤖 AI要約機能付きDiscord通知
📊 堅牢な監視システム

リリース日: $(date +%Y-%m-%d)
"
    git push origin "$CURRENT_BRANCH"
    git push origin "v$NEW_VERSION"
    echo "  ✅ Tag v$NEW_VERSION created and pushed"
else
    echo "  🧪 [DRY RUN] Would create and push tag v$NEW_VERSION"
fi

# Success message
echo -e "${GREEN}🎉 Release process completed successfully!${NC}"
echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}✅ Version: $NEW_VERSION${NC}"
echo -e "${GREEN}✅ Tag: v$NEW_VERSION${NC}"
echo -e "${GREEN}✅ GitHub Actions will automatically create the release${NC}"

if [ "$DRY_RUN" = false ]; then
    echo -e "${BLUE}📦 Release will be available at:${NC}"
    echo -e "${BLUE}https://github.com/yuu1111/LoL-PatchNote-Notifier/releases/tag/v$NEW_VERSION${NC}"
    
    echo -e "${YELLOW}📋 Post-release checklist:${NC}"
    echo -e "  1. Monitor GitHub Actions for successful release build"
    echo -e "  2. Verify release artifacts are properly generated"
    echo -e "  3. Test the released version in a clean environment"
    echo -e "  4. Update deployment environments if needed"
    echo -e "  5. Announce the release to users"
else
    echo -e "${YELLOW}🧪 This was a dry run. No actual changes were made.${NC}"
fi

echo -e "${BLUE}🚀 Happy releasing!${NC}"