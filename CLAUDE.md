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

## Development Guidelines

### Semantic Versioning (SemVer)

This project follows [Semantic Versioning 2.0.0](https://semver.org/) specification:

**Version Format**: `MAJOR.MINOR.PATCH` (e.g., `1.4.2`)

- **MAJOR** version: Incremented for incompatible API changes
  - Breaking changes to configuration format
  - Removal of deprecated features
  - Major architectural changes
  
- **MINOR** version: Incremented for backwards-compatible functionality additions
  - New features (e.g., new notification channels)
  - New configuration options with sensible defaults
  - Performance improvements
  - New optional dependencies
  
- **PATCH** version: Incremented for backwards-compatible bug fixes
  - Bug fixes that don't change functionality
  - Security patches
  - Documentation updates
  - Dependency updates (patch/minor)

**Pre-release versions**: Use suffixes like `-alpha.1`, `-beta.2`, `-rc.1` for pre-release versions.

**Examples**:
- `1.0.0` → `1.0.1` (Bug fix)
- `1.0.1` → `1.1.0` (New feature: Redis support)
- `1.1.0` → `2.0.0` (Breaking: Change config format)

### Semantic Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Format**: `<type>(<scope>): <description>`

#### Commit Types

- **feat**: A new feature for the user
- **fix**: A bug fix for the user
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code changes that neither fix bugs nor add features
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Changes to build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

#### Scopes (Optional)

- **config**: Configuration management
- **scraper**: Patch scraping functionality
- **discord**: Discord notification system
- **storage**: Data persistence layer
- **http**: HTTP client and networking
- **logger**: Logging system
- **monitor**: Patch monitoring orchestration

#### Examples

```bash
# Feature additions
feat(discord): add rich embed support for patch notifications
feat(config): implement Redis storage backend
feat(scraper): add fallback selectors for patch detection

# Bug fixes
fix(http): resolve timeout issues with circuit breaker
fix(config): correct environment variable validation
fix(discord): handle webhook rate limiting properly

# Documentation
docs: update README with deployment instructions
docs(config): add configuration examples for production

# Performance improvements
perf(scraper): optimize CSS selector performance
perf(storage): implement caching for repeated reads

# Breaking changes (use ! or BREAKING CHANGE footer)
feat(config)!: change CHECK_INTERVAL_CRON to CHECK_INTERVAL_MINUTES
feat!: migrate from file storage to Redis by default

# With detailed breaking change description
feat(config)!: simplify interval configuration

BREAKING CHANGE: CHECK_INTERVAL_CRON environment variable has been 
replaced with CHECK_INTERVAL_MINUTES. Update your .env file to use 
integer minutes instead of cron expressions.

Before: CHECK_INTERVAL_CRON=0 */60 * * *
After: CHECK_INTERVAL_MINUTES=60
```

#### Commit Message Rules

1. **Use present tense**: "add feature" not "added feature"
2. **Use imperative mood**: "fix bug" not "fixes bug"
3. **Keep first line under 72 characters**
4. **Capitalize first letter of description**
5. **No period at the end of the description**
6. **Include body for complex changes**
7. **Reference issues**: `fix(scraper): resolve timeout issues (#123)`

#### Automated Versioning

Commits trigger automatic version bumps:
- `fix:` → PATCH version bump
- `feat:` → MINOR version bump  
- `feat!:` or `BREAKING CHANGE:` → MAJOR version bump