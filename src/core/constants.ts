/**
 * Application constants for the LoL Patch Notification System
 */

export const APP_CONFIG = {
  /** Application name */
  NAME: 'LoL Patch Notifier',
  /** Application version */
  VERSION: '1.0.0',
  /** User agent string for HTTP requests */
  USER_AGENT: 'LoL-Patch-Notifier/1.0.0 (+https://github.com/lol-patch-notifier)',
} as const;

export const DEFAULT_CONFIG = {
  /** Default LoL patch notes URL */
  LOL_PATCH_NOTES_URL: 'https://www.leagueoflegends.com/ja-jp/news/game-updates/',
  /** Default storage file path */
  LAST_STATUS_FILE_PATH: './data/last_patch_status.json',
  /** Default check interval in minutes */
  CHECK_INTERVAL_MINUTES: 90,
  /** Default log level */
  LOG_LEVEL: 'info',
  /** Default Node environment */
  NODE_ENV: 'development',
  /** Default HTTP request timeout */
  REQUEST_TIMEOUT_MS: 30000,
  /** Default maximum retries */
  MAX_RETRIES: 3,
  /** Default rate limit per hour */
  RATE_LIMIT_PER_HOUR: 20,
  /** Default circuit breaker failure threshold */
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: 5,
  /** Default circuit breaker reset timeout */
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 60000,
  /** Default circuit breaker monitoring period */
  CIRCUIT_BREAKER_MONITORING_PERIOD_MS: 120000,
} as const;

export const DISCORD_CONFIG = {
  /** Discord purple color in decimal format */
  EMBED_COLOR: 5814783,
  /** Maximum length for Discord embed title */
  MAX_TITLE_LENGTH: 256,
  /** Maximum length for Discord embed description */
  MAX_DESCRIPTION_LENGTH: 4096,
  /** Discord webhook timeout */
  WEBHOOK_TIMEOUT_MS: 10000,
} as const;

export const HTTP_CONFIG = {
  /** Base URL for League of Legends website */
  LOL_BASE_URL: 'https://www.leagueoflegends.com',
  /** HTTP headers for requests */
  DEFAULT_HEADERS: {
    'User-Agent': APP_CONFIG.USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  },
  /** HTTP status code ranges */
  STATUS_CODES: {
    SUCCESS_MIN: 200,
    SUCCESS_MAX: 299,
    CLIENT_ERROR_MIN: 400,
    CLIENT_ERROR_MAX: 499,
    SERVER_ERROR_MIN: 500,
    SERVER_ERROR_MAX: 599,
  },
} as const;

export const SCRAPING_CONFIG = {
  /** CSS selectors for scraping with fallback priority */
  SELECTORS: {
    /** Primary selector using action class for patch links */
    PRIMARY: 'a.action[href*="/news/game-updates/patch-"]',
    /** Fallback selector using broader action class */
    FALLBACK: 'a.action[href*="/news/game-updates/"]',
    /** Last resort selector using any action link */
    LAST_RESORT: 'a.action',
  },
  /** Title extraction selectors */
  TITLE_SELECTORS: [
    '.news-card-title',
    '.card-title',
    'h3',
    '.title',
    // For the current site structure, text might be directly in the link
    '',  // Will use link text directly
  ],
  /** URL validation patterns */
  URL_PATTERNS: [
    /\/news\/game-updates\/patch-[\d.-]+-notes/i,
    /\/news\/game-updates\/patch-[\d.-]+/i,
    /\/news\/game-updates\/[^/]+/i,
  ],
  /** Maximum age for cache in milliseconds (5 minutes) */
  CACHE_MAX_AGE_MS: 5 * 60 * 1000,
} as const;

export const CIRCUIT_BREAKER_CONFIG = {
  /** Circuit breaker states */
  STATES: {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN',
  },
  /** Default configuration values */
  DEFAULTS: {
    FAILURE_THRESHOLD: 5,
    RESET_TIMEOUT_MS: 60000,
    MONITORING_PERIOD_MS: 120000,
    SUCCESS_THRESHOLD_HALF_OPEN: 2,
  },
} as const;

export const RETRY_CONFIG = {
  /** Retry delay calculation: Math.min(baseDelay * (2 ** attempt), maxDelay) */
  BASE_DELAY_MS: 1000,
  /** Maximum delay between retries */
  MAX_DELAY_MS: 30000,
  /** Jitter factor for randomization (0-1) */
  JITTER_FACTOR: 0.1,
  /** Retryable HTTP status codes */
  RETRYABLE_STATUS_CODES: [408, 429, 502, 503, 504],
} as const;

export const STORAGE_CONFIG = {
  /** Storage key for last status */
  LAST_STATUS_KEY: 'last_patch_status',
  /** Storage key for metrics */
  METRICS_KEY: 'application_metrics',
  /** Storage key for circuit breaker state */
  CIRCUIT_BREAKER_KEY: 'circuit_breaker_state',
  /** Storage key for patch cache */
  PATCH_CACHE_KEY: 'patch_cache',
  /** Default data directory */
  DEFAULT_DATA_DIR: './data',
  /** Directory for individual patch files */
  PATCHES_DIR: './data/patches',
  /** File encoding */
  FILE_ENCODING: 'utf-8',
  /** JSON indentation */
  JSON_INDENT: 2,
} as const;

export const CACHE_CONFIG = {
  /** Default maximum number of cached patches (no automatic deletion) */
  DEFAULT_MAX_SIZE: 10000,
  /** Default TTL in milliseconds (no automatic expiration) */
  DEFAULT_TTL_MS: 31536000000, // 1 year
  /** Cache statistics update interval */
  STATS_UPDATE_INTERVAL_MS: 60000, // 1 minute
} as const;

export const LOGGING_CONFIG = {
  /** Log levels */
  LEVELS: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  },
  /** Redacted fields in logs */
  REDACTED_FIELDS: [
    'password',
    'token',
    'key',
    'secret',
    'webhook',
    'authorization',
  ],
  /** Maximum log message length */
  MAX_MESSAGE_LENGTH: 10000,
} as const;

export const VALIDATION_CONFIG = {
  /** URL validation regex */
  URL_REGEX: /^https?:\/\/.+/i,
  /** Webhook URL validation regex */
  DISCORD_WEBHOOK_REGEX: /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/i,
  /** Cron expression validation regex - more flexible for various intervals */
  CRON_REGEX: /^(\*|[0-5]?\d|\*\/\d+) (\*|[01]?\d|2[0-3]|\*\/\d+) (\*|[12]?\d|3[01]|\*\/\d+) (\*|[01]?\d|\*\/\d+) (\*|[0-6]|\*\/\d+)$/,
  /** Maximum string lengths */
  MAX_LENGTHS: {
    TITLE: 500,
    URL: 2000,
    DESCRIPTION: 5000,
  },
} as const;