/**
 * Application configuration
 * Environment variables and app settings
 */

import type { AppConfig } from '../types';

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = ['DISCORD_WEBHOOK_URL', 'GEMINI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Generate session-based log filename - generated once at application startup
 */
const SESSION_START_TIME = new Date();
const SESSION_LOG_FILENAME = ((): string => {
  const year = SESSION_START_TIME.getFullYear();
  const month = String(SESSION_START_TIME.getMonth() + 1).padStart(2, '0');
  const day = String(SESSION_START_TIME.getDate()).padStart(2, '0');
  const hour = String(SESSION_START_TIME.getHours()).padStart(2, '0');
  const minute = String(SESSION_START_TIME.getMinutes()).padStart(2, '0');

  return `logs/${year}-${month}-${day}-${hour}-${minute}.log`;
})();

function generateLogFilename(): string {
  return SESSION_LOG_FILENAME;
}

/**
 * Parse environment variable as integer with default
 */
function parseEnvInt(envVar: string | undefined, defaultValue: string): number {
  return parseInt(envVar ?? defaultValue, 10);
}

/**
 * Parse environment variable as float with default
 */
function parseEnvFloat(envVar: string | undefined, defaultValue: string): number {
  return parseFloat(envVar ?? defaultValue);
}

/**
 * Create gemini configuration
 */
function createGeminiConfig(apiKey: string): AppConfig['gemini'] {
  return {
    apiKey,
    model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    temperature: parseEnvFloat(process.env.GEMINI_TEMPERATURE, '0.3'),
    maxTokens: parseEnvInt(process.env.GEMINI_MAX_TOKENS, '8192'),
    timeout: parseEnvInt(process.env.GEMINI_TIMEOUT, '60000'),
    maxRetries: parseEnvInt(process.env.GEMINI_MAX_RETRIES, '3'),
  };
}

/**
 * Create http configuration
 */
function createHttpConfig(): AppConfig['http'] {
  return {
    timeout: parseEnvInt(process.env.REQUEST_TIMEOUT, '30000'),
    maxRetries: parseEnvInt(process.env.MAX_RETRIES, '3'),
    retryDelay: parseEnvInt(process.env.RETRY_DELAY, '1000'),
  };
}

/**
 * Create rate limit configuration
 */
function createRateLimitConfig(): AppConfig['rateLimit'] {
  return {
    maxRequestsPerHour: parseEnvInt(process.env.MAX_REQUESTS_PER_HOUR, '20'),
    windowMs: parseEnvInt(process.env.RATE_LIMIT_WINDOW, '3600000'),
  };
}

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): AppConfig {
  validateEnvironment();

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!webhookUrl || !geminiApiKey) {
    throw new Error('Critical environment variables are missing after validation');
  }

  return {
    discord: {
      webhookUrl,
    },
    lol: {
      patchNotesUrl:
        process.env.LOL_PATCH_NOTES_URL ??
        'https://www.leagueoflegends.com/ja-jp/news/tags/patch-notes',
    },
    gemini: createGeminiConfig(geminiApiKey),
    monitoring: {
      checkIntervalMinutes: parseEnvInt(process.env.CHECK_INTERVAL_MINUTES, '90'),
    },
    logging: {
      level: process.env.LOG_LEVEL ?? 'info',
      filePath: generateLogFilename(),
    },
    storage: {
      patchesDir: 'patches',
      imagesDir: 'patches/images',
      summariesDir: 'patches/summaries',
    },
    http: createHttpConfig(),
    rateLimit: createRateLimitConfig(),
  };
}

/**
 * Get the current configuration (lazy loading)
 */
let _config: AppConfig | null = null;

export const config = new Proxy({} as AppConfig, {
  get(target, prop): unknown {
    _config ??= loadConfig();
    return _config[prop as keyof AppConfig];
  },
});
