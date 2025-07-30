/**
 * Configuration management with runtime validation
 */

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

import { ConfigurationError } from '../core/errors.js';
import { envSchema, type EnvConfig } from './schemas.js';

// Load environment variables from .env file
dotenvConfig();

/**
 * Validates and exports the application configuration
 */
class Configuration {
  private _config: EnvConfig | null = null;

  /**
   * Get the validated configuration
   */
  get config(): EnvConfig {
    if (!this._config) {
      this._config = this.loadAndValidateConfig();
    }
    return this._config;
  }

  /**
   * Load and validate configuration from environment variables
   */
  private loadAndValidateConfig(): EnvConfig {
    try {
      const parseResult = envSchema.safeParse(process.env);

      if (!parseResult.success) {
        const errorDetails = parseResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          received: 'input' in err ? err.input : undefined,
        }));

        throw new ConfigurationError(
          'Environment variable validation failed',
          { errors: errorDetails }
        );
      }

      const config = parseResult.data;

      // Log configuration summary in development mode
      if (config.NODE_ENV === 'development') {
        this.logConfigurationSummary(config);
      }

      return config;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }

      throw new ConfigurationError(
        'Failed to load configuration',
        { originalError: error }
      );
    }
  }

  /**
   * Log configuration summary for development
   */
  private logConfigurationSummary(config: EnvConfig): void {
    // Use console.log in configuration module since logger depends on config
    // eslint-disable-next-line no-console
    console.log('🔧 Configuration loaded:', {
      nodeEnv: config.NODE_ENV,
      logLevel: config.LOG_LEVEL,
      webhookConfigured: !!config.DISCORD_WEBHOOK_URL,
      patchNotesUrl: config.LOL_PATCH_NOTES_URL,
      statusFilePath: config.LAST_STATUS_FILE_PATH,
      checkInterval: `${config.CHECK_INTERVAL_MINUTES} minutes`,
      requestTimeout: `${config.REQUEST_TIMEOUT_MS}ms`,
      maxRetries: config.MAX_RETRIES,
      rateLimit: `${config.RATE_LIMIT_PER_HOUR}/hour`,
      circuitBreaker: {
        failureThreshold: config.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        resetTimeout: `${config.CIRCUIT_BREAKER_RESET_TIMEOUT_MS}ms`,
      },
      redis: config.REDIS_URL ? 'configured' : 'not configured',
    });
  }

  /**
   * Validate a partial configuration update
   */
  validatePartialConfig(partialConfig: Partial<Record<string, string>>): z.SafeParseReturnType<any, EnvConfig> {
    const mergedEnv = { ...process.env, ...partialConfig };
    return envSchema.safeParse(mergedEnv);
  }

  /**
   * Check if the configuration is valid without throwing
   */
  isValidConfiguration(): boolean {
    try {
      envSchema.parse(process.env);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration validation errors without throwing
   */
  getValidationErrors(): string[] {
    const parseResult = envSchema.safeParse(process.env);
    if (parseResult.success) {
      return [];
    }

    return parseResult.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
  }

  /**
   * Get required environment variables that are missing
   */
  getMissingRequiredVars(): string[] {
    const requiredVars = ['DISCORD_WEBHOOK_URL'];
    return requiredVars.filter(varName => !process.env[varName]);
  }

  /**
   * Check if running in production environment
   */
  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Check if running in development environment
   */
  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  /**
   * Check if Redis is configured
   */
  isRedisConfigured(): boolean {
    return !!this.config.REDIS_URL;
  }

  /**
   * Get sanitized configuration for logging (removes sensitive data)
   */
  getSanitizedConfig(): Record<string, unknown> {
    const config = this.config;
    return {
      NODE_ENV: config.NODE_ENV,
      LOG_LEVEL: config.LOG_LEVEL,
      LOL_PATCH_NOTES_URL: config.LOL_PATCH_NOTES_URL,
      LAST_STATUS_FILE_PATH: config.LAST_STATUS_FILE_PATH,
      CHECK_INTERVAL_MINUTES: config.CHECK_INTERVAL_MINUTES,
      REQUEST_TIMEOUT_MS: config.REQUEST_TIMEOUT_MS,
      MAX_RETRIES: config.MAX_RETRIES,
      RATE_LIMIT_PER_HOUR: config.RATE_LIMIT_PER_HOUR,
      CIRCUIT_BREAKER_FAILURE_THRESHOLD: config.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      CIRCUIT_BREAKER_RESET_TIMEOUT_MS: config.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
      CIRCUIT_BREAKER_MONITORING_PERIOD_MS: config.CIRCUIT_BREAKER_MONITORING_PERIOD_MS,
      DISCORD_WEBHOOK_URL: config.DISCORD_WEBHOOK_URL ? '[CONFIGURED]' : '[NOT SET]',
      REDIS_URL: config.REDIS_URL ? '[CONFIGURED]' : '[NOT SET]',
      REDIS_KEY_PREFIX: config.REDIS_KEY_PREFIX,
    };
  }
}

// Create and export singleton instance
const configInstance = new Configuration();

// Export the configuration object
export const config = configInstance.config;

// Export the configuration class for testing
export { Configuration };

// Export types
export type { EnvConfig } from './schemas.js';