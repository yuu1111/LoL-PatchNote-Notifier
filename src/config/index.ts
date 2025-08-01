/**
 * Application configuration
 * Environment variables and app settings
 */

import { AppConfig } from '../types';

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
 * Load and validate configuration from environment
 */
export function loadConfig(): AppConfig {
  validateEnvironment();

  return {
    discord: {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL!,
    },
    lol: {
      patchNotesUrl: process.env.LOL_PATCH_NOTES_URL ||
        'https://www.leagueoflegends.com/ja-jp/news/tags/patch-notes',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY!,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '8192', 10),
      timeout: parseInt(process.env.GEMINI_TIMEOUT || '60000', 10),
      maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),
    },
    monitoring: {
      checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '90', 10),
    },    logging: {
      level: process.env.LOG_LEVEL || 'info',
      filePath: `logs/${new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '-')}`,
    },
    storage: {
      patchesDir: 'patches',
      imagesDir: 'patches/images',
      summariesDir: 'patches/summaries',
    },
    http: {
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),
    },
    rateLimit: {
      maxRequestsPerHour: parseInt(process.env.MAX_REQUESTS_PER_HOUR || '20', 10),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '3600000', 10),
    },
  };
}

/**
 * Get the current configuration (lazy loading)
 */
let _config: AppConfig | null = null;

export const config = new Proxy({} as AppConfig, {
  get(target, prop) {
    if (!_config) {
      _config = loadConfig();
    }
    return _config[prop as keyof AppConfig];
  }
});