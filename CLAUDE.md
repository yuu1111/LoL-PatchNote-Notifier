# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要: 日本語での対話
このプロジェクトでの対話は**日本語**で行うこと。コミット メッセージ、ログ出力、コメントなども日本語を使用する。

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