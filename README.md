# LoL PatchNote Notifier

A robust League of Legends patch notification system that monitors Japanese patch notes and sends Discord notifications when new patches are published.

## Features

- 🔍 **Intelligent Scraping**: Monitors LoL Japan patch notes with fallback selectors
- 📱 **Discord Integration**: Rich embed notifications with @everyone mentions
- 🛡️ **Resilient Architecture**: Circuit breaker, retry logic, and error handling
- 📊 **Comprehensive Logging**: Structured logging with metrics collection
- ⚙️ **Configurable**: Environment-based configuration with validation
- 🚀 **Production Ready**: Multiple deployment strategies supported
- 🧪 **Well Tested**: Type-safe with comprehensive error handling

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+ (preferred) or npm/yarn
- Discord webhook URL

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LoL-Patch-Notifier
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord webhook URL
   ```

4. **Configure Discord webhook**
   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
   ```

5. **Run the application**
   ```bash
   # Development mode with auto-reload
   pnpm dev

   # Production build and run
   pnpm build
   pnpm start
   ```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_WEBHOOK_URL` | Discord webhook URL (required) | `https://discord.com/api/webhooks/...` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOL_PATCH_NOTES_URL` | `https://www.leagueoflegends.com/ja-jp/news/game-updates/` | LoL patch notes page URL |
| `LAST_STATUS_FILE_PATH` | `./data/last_patch_status.json` | Path for state persistence |
| `CHECK_INTERVAL_CRON` | `0 */90 * * *` | Cron schedule (every 90 minutes) |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `NODE_ENV` | `development` | Environment (`development`, `staging`, `production`) |
| `REQUEST_TIMEOUT_MS` | `30000` | HTTP request timeout |
| `MAX_RETRIES` | `3` | Maximum retry attempts |
| `RATE_LIMIT_PER_HOUR` | `20` | Rate limit for LoL website |

### Advanced Configuration

```env
# Circuit Breaker Settings
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT_MS=60000
CIRCUIT_BREAKER_MONITORING_PERIOD_MS=120000

# Redis (for production deployments)
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=lol-patch-notifier:
```

## Discord Webhook Setup

1. **Open Discord Server Settings**
   - Go to your Discord server
   - Click on "Server Settings" → "Integrations" → "Webhooks"

2. **Create New Webhook**
   - Click "Create Webhook"
   - Set a name (e.g., "LoL Patch Notifier")
   - Choose the channel for notifications
   - Copy the webhook URL

3. **Add to Environment**
   ```env
   DISCORD_WEBHOOK_URL=your_webhook_url_here
   ```

## Usage

### Development

```bash
# Start in development mode with auto-reload
pnpm dev

# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Format code
pnpm format

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Production

```bash
# Build the application
pnpm build

# Start the built application
pnpm start

# Or run directly from source
node dist/app.js
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

## Architecture

### Project Structure

```
src/
├── core/
│   ├── types.ts              # TypeScript type definitions
│   ├── errors.ts             # Custom error classes
│   └── constants.ts          # Application constants
├── config/
│   ├── index.ts              # Configuration management
│   └── schemas.ts            # Zod validation schemas
├── services/
│   ├── PatchScraper.ts       # LoL patch notes scraping
│   ├── DiscordNotifier.ts    # Discord webhook notifications
│   └── PatchMonitor.ts       # Main orchestrator service
├── utils/
│   ├── logger.ts             # Structured logging with Pino
│   ├── storage.ts            # Storage abstraction (file/Redis)
│   ├── httpClient.ts         # HTTP client with circuit breaker
│   └── healthCheck.ts        # Health monitoring utilities
└── app.ts                    # Application entry point
```

### Key Components

- **PatchScraper**: Monitors LoL website with robust HTML parsing
- **DiscordNotifier**: Sends rich Discord notifications
- **PatchMonitor**: Orchestrates the monitoring workflow
- **Storage**: Abstract storage for state persistence
- **HttpClient**: Resilient HTTP client with circuit breaker
- **Logger**: Structured logging with metrics

### Design Patterns

- **Circuit Breaker**: Protects against cascading failures
- **Retry with Exponential Backoff**: Handles transient failures
- **Storage Abstraction**: File storage with Redis option
- **Dependency Injection**: Testable and modular design
- **Error Handling**: Typed errors with context

## Deployment

### Local/Development

```bash
# Clone and setup
git clone <repo>
cd LoL-Patch-Notifier
pnpm install
cp .env.example .env
# Configure .env
pnpm dev
```

### Docker

```dockerfile
# Build image
docker build -t lol-patch-notifier .

# Run container
docker run -d \
  --name lol-patch-notifier \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  lol-patch-notifier
```

### Serverless (AWS Lambda)

1. **Build for Lambda**
   ```bash
   pnpm build
   zip -r function.zip dist/ node_modules/ package.json
   ```

2. **Configure Lambda**
   - Runtime: Node.js 18.x
   - Handler: `dist/app.handler`
   - Timeout: 5 minutes
   - Memory: 256MB

3. **Set Environment Variables**
   - Configure all required environment variables
   - Use AWS Parameter Store for sensitive data

4. **Setup EventBridge**
   - Create schedule rule: `rate(90 minutes)`
   - Target: Your Lambda function

### PaaS (Render, Fly.io)

```yaml
# render.yaml
services:
  - type: web
    name: lol-patch-notifier
    env: node
    buildCommand: pnpm build
    startCommand: pnpm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DISCORD_WEBHOOK_URL
        sync: false  # Set in Render dashboard
```

## Monitoring

### Health Check

The application provides health check endpoints:

```typescript
import { performHealthCheck, basicHealthCheck } from './src/utils/healthCheck.js';

// Comprehensive health check
const health = await performHealthCheck();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'

// Basic health check
const basic = await basicHealthCheck();
console.log(basic.status); // 'ok' | 'error'
```

### Metrics

Built-in metrics collection:

- Request count and success rate
- Scraping attempts and success rate
- Notification attempts and success rate
- Response times and error rates
- Circuit breaker state
- Application uptime

### Logs

Structured JSON logs with:

- Correlation IDs for tracing
- Context-aware logging
- Sensitive data redaction
- Error stack traces
- Performance metrics

## Troubleshooting

### Common Issues

1. **Webhook not working**
   ```bash
   # Test webhook connectivity
   curl -X POST "$DISCORD_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"content": "Test message"}'
   ```

2. **HTML structure changed**
   - Check logs for parsing errors
   - Verify LoL website structure
   - Fallback selectors should handle most cases

3. **Rate limiting**
   - Default: 20 requests/hour
   - Adjust `RATE_LIMIT_PER_HOUR` if needed
   - Monitor circuit breaker state

4. **Storage issues**
   - Check file permissions for `data/` directory
   - Verify Redis connection (if using Redis)
   - Clear storage: delete `data/last_patch_status.json`

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug pnpm dev

# Check application status
curl http://localhost:3000/health  # If running with HTTP server
```

### Reset State

```bash
# Clear cached state
rm -f data/last_patch_status.json

# Force notification on next run
# (Will send notification for current patch)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run quality checks: `pnpm lint && pnpm type-check && pnpm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📧 Create an issue for bug reports
- 💡 Feature requests welcome
- 📖 Check logs for troubleshooting
- 🔧 Health check endpoint for monitoring