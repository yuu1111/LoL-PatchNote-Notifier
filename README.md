# League of Legends Patch Notifier 🎮

An intelligent TypeScript/Node.js system that automatically monitors the official League of Legends patch notes website and sends rich Discord notifications with AI-generated summaries when new patches are released.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2%2B-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Features

### 🤖 AI-Powered Summaries
- **Gemini AI Integration**: Automatically generates comprehensive Japanese summaries of patch notes
- **Key Changes Extraction**: Identifies and highlights the most important changes in each patch
- **Smart Caching**: 7-day cache system to avoid redundant API calls and reduce costs

### 📱 Rich Discord Notifications
- **Enhanced Embeds**: Beautiful Discord notifications with patch titles, versions, and links
- **AI Summary Integration**: Includes generated summaries and key changes in notifications
- **Image Support**: Automatically downloads and embeds patch images
- **Duplicate Prevention**: Smart state management prevents duplicate notifications

### 🔄 Robust Monitoring System
- **Scheduled Monitoring**: Configurable interval checking (default: 60 minutes)
- **Fallback Selectors**: Multiple CSS selectors handle website structure changes
- **Retry Logic**: Exponential backoff for HTTP failures (2s, 4s, 8s)
- **Circuit Breaker**: Prevents cascade failures during outages

### 💾 Data Management
- **Local Caching**: Patch data and images stored locally for reliability
- **State Persistence**: JSON-based state management survives application restarts
- **Organized Storage**: Each patch stored in its own directory with metadata

## 🏗️ Architecture

```
src/
├── app.ts                    # Main application entry point & scheduler
├── config/index.ts           # Environment variables & configuration
├── services/
│   ├── PatchScraper.ts       # HTML scraping & data extraction
│   ├── DiscordNotifier.ts    # Discord webhook notifications
│   ├── GeminiSummarizer.ts   # AI-powered patch summarization
│   ├── ImageDownloader.ts    # Image download & caching
│   ├── StateManager.ts       # State persistence & management
│   └── Scheduler.ts          # Cron-based scheduling
├── utils/
│   ├── logger.ts             # Winston logging system
│   ├── httpClient.ts         # Axios HTTP client with retry logic
│   └── fileStorage.ts        # JSON file persistence utilities
└── types/index.ts            # TypeScript type definitions

patches/                      # Data persistence directory
├── patch_25.15/              # Individual patch directories
│   ├── patch_25.15.json      # Patch data and metadata
│   ├── patch_25.15.jpg       # Cached patch image
│   └── patch_25.15_summary.json # AI-generated summary
└── last_patch_status.json    # State tracking file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- Discord webhook URL
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yuu1111/LoL-PatchNote-Notifier.git
   cd LoL-Patch-Notifier
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   GEMINI_MAX_TOKENS=25000
   LOG_LEVEL=info
   CHECK_INTERVAL_MINUTES=60
   ```

4. **Build and run**
   ```bash
   npm run build
   npm start
   ```

### Development

```bash
# Development with auto-reload
npm run dev

# Type checking & linting
npm run typecheck
npm run lint
npm run format

# Testing
npm test
npm run test:coverage

# Utilities
npm run patch-test    # Test patch detection
npm run kill         # Stop running instances
npm run reset-state  # Reset application state
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for notifications | - | ✅ |
| `GEMINI_API_KEY` | Google Gemini API key for AI summaries | - | ✅ |
| `GEMINI_MODEL` | Gemini model to use | `gemini-2.5-flash` | ❌ |
| `GEMINI_MAX_TOKENS` | Maximum tokens for AI generation | `25000` | ❌ |
| `GEMINI_TEMPERATURE` | AI generation temperature (0.0-1.0) | `0.3` | ❌ |
| `GEMINI_TIMEOUT` | API request timeout (ms) | `60000` | ❌ |
| `GEMINI_MAX_RETRIES` | Maximum retry attempts | `3` | ❌ |
| `LOL_PATCH_NOTES_URL` | LoL patch notes URL | JP official site | ❌ |
| `CHECK_INTERVAL_MINUTES` | Monitoring interval in minutes | `60` | ❌ |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` | ❌ |
| `NODE_ENV` | Environment (development/production) | `development` | ❌ |

### Cost Estimation

With Gemini 2.5 Flash pricing:
- **Per patch summary**: ~$0.0015 (¥0.23)
- **Monthly cost**: ~$0.003 (¥0.5) for 2 patches/month
- **Annual cost**: ~$0.036 (¥5.5)

## 🐳 Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["npm", "start"]
```

### Recommended Deployment Options

1. **AWS Lambda + EventBridge** (Recommended)
   - Serverless with scheduled triggers
   - Pay-per-execution pricing
   - Auto-scaling and high availability

2. **Docker + Kubernetes CronJob**
   - Container-based deployment
   - Resource management and scaling
   - Built-in monitoring and logging

3. **Platform-as-a-Service**
   - Render, Fly.io, Railway
   - Simple deployment with built-in cron
   - Managed infrastructure

## 🔧 Technology Stack

### Core Dependencies
- **[@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)** `^0.24.1` - Gemini AI integration
- **[axios](https://www.npmjs.com/package/axios)** `^1.6.0` - HTTP client with retry logic
- **[cheerio](https://www.npmjs.com/package/cheerio)** `^1.0.0-rc.12` - Server-side HTML parsing
- **[winston](https://www.npmjs.com/package/winston)** `^3.11.0` - Structured logging
- **[node-cron](https://www.npmjs.com/package/node-cron)** `^3.0.3` - Task scheduling
- **[dotenv](https://www.npmjs.com/package/dotenv)** `^16.3.0` - Environment configuration

### Development Tools
- **TypeScript** `^5.2.0` - Type-safe JavaScript
- **ESLint + Prettier** - Code quality and formatting
- **Jest** `^29.7.0` - Testing framework
- **tsx** `^4.20.3` - TypeScript execution and watch mode

## 📊 Monitoring & Performance

### Service Level Indicators (SLIs)
- **Success Rate**: 99.5% target
- **Response Time**: <2s for patch detection
- **Error Rate**: <0.1% for critical operations
- **Availability**: 99.9% uptime target

### Logging & Observability
- **Structured Logging**: Winston with timestamp-based log directories
- **Error Tracking**: Comprehensive error handling with context
- **Performance Metrics**: Response times and success rates
- **Resource Usage**: Designed for 256MB memory footprint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Standards
- **Semantic Commits**: Use conventional commit format (`feat:`, `fix:`, `refactor:`)
- **Semantic Versioning**: Follow semver for releases (MAJOR.MINOR.PATCH)
- **Code Quality**: ESLint + Prettier for consistent formatting
- **Testing**: Maintain test coverage for critical functionality

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Links

- [League of Legends Official Patch Notes](https://www.leagueoflegends.com/ja-jp/news/tags/patch-notes)
- [Discord Webhook Documentation](https://discord.com/developers/docs/resources/webhook)
- [Google Gemini API Documentation](https://ai.google.dev/docs)

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yuu1111/LoL-PatchNote-Notifier/issues) page
2. Review the logs in the `logs/` directory
3. Ensure your environment variables are correctly configured
4. Verify your Discord webhook and Gemini API key are valid

---

**Made with ❤️ for the League of Legends community**