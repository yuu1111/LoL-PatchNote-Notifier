# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要: 日本語での対話
このプロジェクトでの対話は**日本語**で行うこと。コミット メッセージ、ログ出力、コメントなども日本語を使用する。

## Release Rules
- **GitHub Releases**: All release content (release notes, descriptions, changelogs) must be written in **English**
- **Git Tags**: Use English for tag messages and descriptions
- **Release Artifacts**: Documentation and installation instructions in English
- **International Accessibility**: Ensure releases are accessible to global users

## Project Overview

League of Legends Patch Notifier - A TypeScript/Node.js system that monitors the official LoL patch notes website and automatically sends Discord notifications when new patches are released.

**Core Workflow**: Monitor LoL patch notes → Extract patch info & images → Cache locally → Send Discord notification

## Architecture & Key Components

### Directory Structure
```
src/
├── app.ts                  # Main application entry point & scheduler
├── config/index.ts         # Environment variables & configuration
├── services/
│   ├── PatchScraper.ts     # HTML scraping & data extraction
│   ├── DiscordNotifier.ts  # Discord webhook notifications
│   └── ImageDownloader.ts  # Image download & caching
├── utils/
│   ├── logger.ts           # Winston logging (plain text)
│   ├── httpClient.ts       # Axios HTTP client with retry logic
│   └── fileStorage.ts      # JSON file persistence
└── types/index.ts          # TypeScript type definitions

patches/                    # Data persistence directory
├── images/                 # Cached patch images
├── patch-{version}.json    # Individual patch data
└── last_patch_status.json  # State tracking file
```

### Core Services
- **PatchScraper**: Scrapes LoL official site using Cheerio, extracts titles/URLs/images with fallback selectors
- **DiscordNotifier**: Sends Discord Embed notifications via webhook with image attachments
- **ImageDownloader**: Downloads and caches patch images locally for Discord embeds
- **State Management**: JSON-based persistence to prevent duplicate notifications

## Development Commands

```bash
# Development with auto-reload
npm run dev

# Type checking & linting
npm run lint
npm run format
npm test

# Production build & run
npm run build
npm start
```

## Technology Stack

**Core Dependencies:**
- `axios` - HTTP client with retry logic
- `cheerio` - HTML parsing (jQuery-like API)
- `winston` - Structured logging (plain text output)
- `node-cron` - Scheduled monitoring (90-minute intervals)
- `dotenv` - Environment configuration
- `jest` - Testing framework

**Target Runtime:** Node.js LTS with TypeScript compilation

## Key Development Considerations

### Development Standards
- **Semantic Commits**: Use conventional commit format (`feat:`, `fix:`, `refactor:`, etc.)
- **Semantic Versioning**: Follow semver for releases (MAJOR.MINOR.PATCH)

### Environment Configuration
Required environment variables in `.env`:
- `DISCORD_WEBHOOK_URL` - Discord webhook for notifications
- `LOL_PATCH_NOTES_URL` - Target patch notes page (defaults to JP site)
- `CHECK_INTERVAL_CRON` - Monitoring schedule (default: 90 minutes)
- `LOG_LEVEL` - Logging verbosity

### Error Handling & Resilience
- **Rate Limiting**: Max 20 requests/hour to protect Riot servers
- **Circuit Breaker**: Prevents cascade failures during outages
- **Retry Logic**: Exponential backoff (1s, 2s, 4s) for HTTP failures
- **Fallback Selectors**: Multiple CSS selectors for HTML structure changes
- **State Recovery**: JSON persistence survives application restarts

### HTML Scraping Strategy
The system uses multiple fallback CSS selectors to handle website structure changes:
1. Data attributes (most stable)
2. Class names (moderately stable)
3. Element structure (least stable)

### Testing Approach
- Unit tests for core services with Jest mocking
- Integration tests for Discord webhook functionality
- HTTP request mocking for external dependencies

### Performance & Monitoring
- **SLI Targets**: 99.5% success rate, <2s response time, <0.1% error rate
- **Monitoring**: Winston logs with structured output for operations
- **Resource Usage**: Designed for serverless deployment (256MB memory)

## Operational Notes

**Deployment Options:**
- **Recommended**: AWS Lambda with EventBridge scheduling
- **Alternative**: Docker container with K8s CronJob
- **Simple**: PaaS with built-in cron (Render, Fly.io)

**State Management**: Uses local JSON files for simplicity - ensure persistent storage in production deployments.

**Discord Integration**: Sends rich embeds with patch titles, URLs, cached images, and timestamp formatting.

## Development Standards

### Package Management
- **Always use npm commands when adding dependencies to package.json**
- Never edit package.json directly

```bash
# Regular dependencies
npm install <package-name>

# Development dependencies
npm install --save-dev <package-name>

# Install specific version
npm install <package-name>@<version>
```

### Code Quality Rules

#### ESLint Configuration Policy
- **Relaxing ESLint settings is prohibited**
- Adding rules and strictification within reasonable limits is recommended
- Configuration changes that improve project quality are actively encouraged
- Document reasons clearly when changing rules

**Current strict configuration**:
```typescript
// TypeScript strictification
'@typescript-eslint/explicit-function-return-type': 'error'
'@typescript-eslint/no-non-null-assertion': 'error'
'@typescript-eslint/prefer-nullish-coalescing': 'error'
'@typescript-eslint/prefer-optional-chain': 'error'

// Code quality rules
'complexity': ['error', { max: 10 }]
'max-depth': ['error', 4]
'max-lines-per-function': ['warn', { max: 80 }]
'max-params': ['error', 4]

// Security rules
'no-eval': 'error'
'no-implied-eval': 'error'
'no-new-func': 'error'

// Naming conventions
'@typescript-eslint/naming-convention': [
  { selector: 'interface', format: ['PascalCase'] },
  { selector: 'class', format: ['PascalCase'] },
  { selector: 'function', format: ['camelCase'] }
]
```

**Configuration change examples**:
```bash
# Allowed changes (strictification)
- Adding rules: @typescript-eslint/no-unused-vars: "error"
- Existing rule strictification: complexity: ["error", { "max": 8 }]

# Prohibited changes (relaxation)
- Disabling rules: "no-console": "off"
- Lowering error levels: "@typescript-eslint/no-any": "warn" → "off"
```

#### ESLint Disable Comments Policy
**コメントによるESLint警告の抑制は厳格に禁止**

以下のESLint無効化コメントの使用は一切禁止されています：
```typescript
// 禁止例
/* eslint-disable */
/* eslint-disable-next-line */
/* eslint-disable-line */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// @ts-ignore
// @ts-nocheck
```

**警告への対処方法**：
1. **コードの修正を優先**: 警告の根本原因を解決する
2. **型安全性の確保**: `any`型を避け、適切な型定義を行う
3. **リファクタリング**: 複雑度が高い場合は関数を分割
4. **設計の見直し**: ルール違反が多い場合は設計を再検討

**例外なし**: 技術的制約や外部ライブラリの問題であっても、コメントによる抑制は許可されません。代わりに以下の対応を検討：
- 型定義ファイル（`.d.ts`）の作成
- ラッパー関数の実装
- 代替ライブラリの検討

#### Regular Code Quality Checks
Execute the following full checks regularly during development:

```bash
# Full code quality check (recommended execution order)
npm run lint           # ESLint execution
npm run format:check   # Prettier format check
npm run build          # TypeScript type check + build
npm test               # Test execution

# Or batch execution alias
npm run quality:check  # Execute all quality checks sequentially
```

**Check execution timing**:
- Before commits (automatically executed by Husky)
- Before creating pull requests
- At the end of development sessions
- After major feature implementations
- During weekly reviews

**Error handling policy**:
- ESLint errors: Must fix before committing
- TypeScript errors: Prioritize type safety and fix
- Test errors: Fix after confirming functionality works properly
- Prettier errors: Auto-fix with `npm run format`