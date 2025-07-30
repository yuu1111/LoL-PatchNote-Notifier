/**
 * Zod validation schemas for configuration
 */

import { z } from 'zod';

import { DEFAULT_CONFIG, VALIDATION_CONFIG } from '../core/constants.js';

/**
 * Environment variable schema with validation rules
 */
export const envSchema = z.object({
  // Discord Configuration (Required)
  DISCORD_WEBHOOK_URL: z
    .string()
    .min(1, 'Discord webhook URL is required')
    .regex(VALIDATION_CONFIG.DISCORD_WEBHOOK_REGEX, 'Invalid Discord webhook URL format'),

  // LoL Patch Notes Configuration (Optional)
  LOL_PATCH_NOTES_URL: z
    .string()
    .url('Invalid LoL patch notes URL')
    .default(DEFAULT_CONFIG.LOL_PATCH_NOTES_URL),

  // Storage Configuration (Optional)
  LAST_STATUS_FILE_PATH: z
    .string()
    .min(1, 'Status file path cannot be empty')
    .default(DEFAULT_CONFIG.LAST_STATUS_FILE_PATH),

  // Scheduling Configuration (Optional)
  CHECK_INTERVAL_MINUTES: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(1).max(1440)) // 1 minute to 24 hours
    .default(DEFAULT_CONFIG.CHECK_INTERVAL_MINUTES.toString())
    .transform(val => typeof val === 'string' ? parseInt(val, 10) : val),

  // Logging Configuration (Optional)
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default(DEFAULT_CONFIG.LOG_LEVEL),
  
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default(DEFAULT_CONFIG.NODE_ENV),

  // HTTP Configuration (Optional)
  REQUEST_TIMEOUT_MS: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(1000).max(300000))
    .default(DEFAULT_CONFIG.REQUEST_TIMEOUT_MS.toString())
    .transform(val => typeof val === 'string' ? parseInt(val, 10) : val),

  MAX_RETRIES: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(0).max(10))
    .default(DEFAULT_CONFIG.MAX_RETRIES.toString())
    .transform(val => typeof val === 'string' ? parseInt(val, 10) : val),

  RATE_LIMIT_PER_HOUR: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(1).max(1000))
    .default(DEFAULT_CONFIG.RATE_LIMIT_PER_HOUR.toString())
    .transform(val => typeof val === 'string' ? parseInt(val, 10) : val),

  // Circuit Breaker Configuration (Optional)
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(1).max(100))
    .default(DEFAULT_CONFIG.CIRCUIT_BREAKER_FAILURE_THRESHOLD.toString())
    .transform(val => typeof val === 'string' ? parseInt(val, 10) : val),

  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(1000).max(3600000))
    .default(DEFAULT_CONFIG.CIRCUIT_BREAKER_RESET_TIMEOUT_MS.toString())
    .transform(val => typeof val === 'string' ? parseInt(val, 10) : val),

  CIRCUIT_BREAKER_MONITORING_PERIOD_MS: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(10000).max(7200000))
    .default(DEFAULT_CONFIG.CIRCUIT_BREAKER_MONITORING_PERIOD_MS.toString())
    .transform(val => typeof val === 'string' ? parseInt(val, 10) : val),

  // Redis Configuration (Optional - for production deployments)
  REDIS_URL: z
    .string()
    .url('Invalid Redis URL')
    .optional(),

  REDIS_KEY_PREFIX: z
    .string()
    .min(1, 'Redis key prefix cannot be empty')
    .optional()
    .default('lol-patch-notifier:'),
});

/**
 * Patch information schema for validation
 */
export const patchInfoSchema = z.object({
  title: z
    .string()
    .min(1, 'Patch title cannot be empty')
    .max(VALIDATION_CONFIG.MAX_LENGTHS.TITLE, 'Patch title too long'),
  url: z
    .string()
    .url('Invalid patch URL')
    .max(VALIDATION_CONFIG.MAX_LENGTHS.URL, 'Patch URL too long'),
  discoveredAt: z
    .string()
    .datetime('Invalid timestamp format')
    .optional(),
});

/**
 * Last status schema for validation
 */
export const lastStatusSchema = z.object({
  lastNotifiedUrl: z
    .string()
    .url('Invalid last notified URL')
    .max(VALIDATION_CONFIG.MAX_LENGTHS.URL, 'URL too long'),
  lastNotifiedAt: z
    .string()
    .datetime('Invalid timestamp format'),
  lastNotifiedTitle: z
    .string()
    .max(VALIDATION_CONFIG.MAX_LENGTHS.TITLE, 'Title too long')
    .optional(),
});

/**
 * Discord embed schema for validation
 */
export const discordEmbedSchema = z.object({
  title: z
    .string()
    .min(1, 'Embed title cannot be empty')
    .max(256, 'Embed title exceeds Discord limit'),
  url: z
    .string()
    .url('Invalid embed URL'),
  description: z
    .string()
    .min(1, 'Embed description cannot be empty')
    .max(4096, 'Embed description exceeds Discord limit'),
  color: z
    .number()
    .int('Color must be an integer')
    .min(0, 'Color must be non-negative')
    .max(16777215, 'Color exceeds maximum value'),
  timestamp: z
    .string()
    .datetime('Invalid timestamp format')
    .optional(),
  footer: z
    .object({
      text: z.string().max(2048, 'Footer text too long'),
      icon_url: z.string().url('Invalid footer icon URL').optional(),
    })
    .optional(),
  thumbnail: z
    .object({
      url: z.string().url('Invalid thumbnail URL'),
    })
    .optional(),
});

/**
 * Discord webhook payload schema for validation
 */
export const discordWebhookPayloadSchema = z.object({
  content: z
    .string()
    .max(2000, 'Content exceeds Discord limit')
    .optional(),
  embeds: z
    .array(discordEmbedSchema)
    .max(10, 'Too many embeds (Discord limit: 10)')
    .optional(),
  username: z
    .string()
    .max(80, 'Username too long')
    .optional(),
  avatar_url: z
    .string()
    .url('Invalid avatar URL')
    .optional(),
});

/**
 * Application metrics schema for validation
 */
export const applicationMetricsSchema = z.object({
  scrapingAttempts: z.number().int().min(0),
  successfulScrapes: z.number().int().min(0),
  failedScrapes: z.number().int().min(0),
  notificationsSent: z.number().int().min(0),
  successfulNotifications: z.number().int().min(0),
  failedNotifications: z.number().int().min(0),
  averageResponseTime: z.number().min(0),
  lastSuccessfulOperation: z.string().datetime().optional(),
  lastError: z.string().datetime().optional(),
});

/**
 * Circuit breaker state schema for validation
 */
export const circuitBreakerStateSchema = z.object({
  state: z.enum(['CLOSED', 'OPEN', 'HALF_OPEN']),
  failureCount: z.number().int().min(0),
  lastFailureTime: z.number().optional(),
  lastOpenTime: z.number().optional(),
  successCount: z.number().int().min(0),
});

// Type exports
export type EnvConfig = z.infer<typeof envSchema>;
export type PatchInfoValidated = z.infer<typeof patchInfoSchema>;
export type LastStatusValidated = z.infer<typeof lastStatusSchema>;
export type DiscordEmbedValidated = z.infer<typeof discordEmbedSchema>;
export type DiscordWebhookPayloadValidated = z.infer<typeof discordWebhookPayloadSchema>;
export type ApplicationMetricsValidated = z.infer<typeof applicationMetricsSchema>;
export type CircuitBreakerStateValidated = z.infer<typeof circuitBreakerStateSchema>;