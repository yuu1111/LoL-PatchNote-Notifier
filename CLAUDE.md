# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a League of Legends patch notification system that monitors the Japanese LoL patch notes page and sends Discord notifications when new patches are published. The project is currently in the specification phase with detailed requirements documented in `仕様書.MD`.

## Technology Stack

- **Language**: TypeScript with Node.js (LTS)
- **Module System**: ES Modules (ESM)
- **Package Manager**: pnpm (preferred) or yarn
- **Key Dependencies**:
  - `axios` - HTTP client for web scraping and Discord webhooks
  - `cheerio` - Server-side HTML parsing (jQuery-like API)
  - `dotenv` - Environment variable management
  - `winston` or `pino` - Structured logging
  - `node-cron` - Task scheduling
  - `fs/promises` - Async file I/O for state persistence

## Planned Architecture

The system follows a modular service-oriented architecture:

```
src/
├── app.ts                  # Main application entry point with cron scheduling
├── config/
│   └── index.ts            # Environment variable loading and validation
├── services/
│   ├── PatchScraper.ts     # LoL patch notes scraping logic
│   └── DiscordNotifier.ts  # Discord webhook notification sender
├── utils/
│   ├── logger.ts           # Winston logging configuration
│   └── fileStorage.ts      # JSON file persistence utilities
└── types/
    └── index.ts            # TypeScript type definitions
```

## Development Commands

Once implemented, the project will use these commands:

```bash
# Development
pnpm install              # Install dependencies
pnpm dev                  # Run with ts-node-dev auto-reload
pnpm build                # Compile TypeScript to JavaScript
pnpm start                # Run compiled JavaScript

# Code Quality
pnpm lint                 # ESLint with TypeScript rules
pnpm format               # Prettier code formatting
pnpm test                 # Jest unit and integration tests
```

## Key Design Patterns

### Configuration Management
- Environment variables loaded via `dotenv`
- Required config validation at startup
- Type-safe configuration exports

### Error Handling
- Comprehensive error catching for HTTP requests, HTML parsing, and file I/O
- Structured logging with winston
- Graceful degradation for network failures

### State Persistence
- JSON file storage for tracking last notified patch
- Async file operations with proper error handling
- State comparison logic to detect new patches

### Web Scraping Strategy
- Robust CSS selectors using data attributes where possible
- Timeout configuration for HTTP requests
- HTML structure change resilience

## Environment Variables

The system requires these environment variables:

- `DISCORD_WEBHOOK_URL` - Discord webhook URL (required)
- `LOL_PATCH_NOTES_URL` - LoL patch notes page URL (optional, has default)
- `LAST_STATUS_FILE_PATH` - Path for state persistence file (optional)
- `CHECK_INTERVAL_CRON` - Cron schedule for patch checking (optional)
- `LOG_LEVEL` - Logging level (optional, defaults to 'info')

## Discord Integration

The system sends rich embed notifications containing:
- Patch title extracted from LoL website
- Direct URL to the patch notes
- Timestamp and custom Discord purple color (#581478)
- @everyone mention for Discord notifications

## Deployment Considerations

The specification outlines three deployment strategies:
1. **Serverless** (AWS Lambda, Google Cloud Functions, Vercel)
2. **Container** (Docker with ECS/GKE)
3. **PaaS** (Render, Fly.io)

For serverless deployments, state persistence needs to be moved from JSON files to cloud storage (S3, Cloud Storage, Redis, DynamoDB).