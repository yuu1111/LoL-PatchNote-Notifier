/**
 * Structured logging utility using Pino
 */

import pino from 'pino';

import { config } from '../config/index.js';
import { APP_CONFIG, LOGGING_CONFIG } from '../core/constants.js';
import { isAppError, extractErrorInfo } from '../core/errors.js';

/**
 * Create and configure the logger instance
 */
function createLogger(): pino.Logger {
  // Generate log filename with current date and time
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const logFileName = `${year}-${month}-${day}-${hour}${minute}.log`;
  const logFilePath = `logs/${logFileName}`;

  const loggerConfig: pino.LoggerOptions = {
    level: config.LOG_LEVEL,
    name: APP_CONFIG.NAME,
    
    // Timestamp configuration
    timestamp: pino.stdTimeFunctions.isoTime,

    // Serializers for common objects
    serializers: {
      error: (error: Error) => {
        if (isAppError(error)) {
          return {
            type: error.name,
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            context: error.context,
            timestamp: error.timestamp,
            stack: error.stack,
          };
        }
        return pino.stdSerializers.err(error);
      },
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },

    // Redact sensitive information
    redact: {
      paths: LOGGING_CONFIG.REDACTED_FIELDS.map(field => `*.${field}`),
      censor: '[REDACTED]',
    },

    // Base fields to include in all logs
    base: {
      env: config.NODE_ENV,
      version: APP_CONFIG.VERSION,
    },
  };

  // Configure multiple transports: console + file
  loggerConfig.transport = {
    targets: [
      // Console output with pretty formatting
      {
        target: 'pino-pretty',
        level: config.LOG_LEVEL,
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname,name,env,version',
          singleLine: false,
          messageFormat: '{msg}',
        },
      },
      // File output with structured JSON
      {
        target: 'pino/file',
        level: config.LOG_LEVEL,
        options: {
          destination: logFilePath,
          mkdir: true,
        },
      },
    ],
  };

  return pino(loggerConfig);
}

// Create the logger instance
const logger = createLogger();

// Log the file path on startup
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hour = String(now.getHours()).padStart(2, '0');
const minute = String(now.getMinutes()).padStart(2, '0');
const currentLogFile = `logs/${year}-${month}-${day}-${hour}${minute}.log`;

logger.info(`📝 Logs will be written to: ${currentLogFile}`);

/**
 * Application metrics tracking
 */
class Metrics {
  private errorCount = 0;
  private requestCount = 0;
  private scrapingAttempts = 0;
  private successfulScrapes = 0;
  private notificationsSent = 0;
  private successfulNotifications = 0;
  private totalResponseTime = 0;
  private lastError: string | null = null;
  private lastSuccessfulOperation: string | null = null;

  incrementError(): void {
    this.errorCount++;
    this.lastError = new Date().toISOString();
  }

  incrementRequest(): void {
    this.requestCount++;
  }

  incrementScrapingAttempt(): void {
    this.scrapingAttempts++;
  }

  incrementSuccessfulScrape(): void {
    this.successfulScrapes++;
    this.lastSuccessfulOperation = new Date().toISOString();
  }

  incrementNotificationSent(): void {
    this.notificationsSent++;
  }

  incrementSuccessfulNotification(): void {
    this.successfulNotifications++;
    this.lastSuccessfulOperation = new Date().toISOString();
  }

  addResponseTime(responseTime: number): void {
    this.totalResponseTime += responseTime;
  }

  getMetrics(): {
    errorCount: number;
    requestCount: number;
    scrapingAttempts: number;
    successfulScrapes: number;
    failedScrapes: number;
    notificationsSent: number;
    successfulNotifications: number;
    failedNotifications: number;
    averageResponseTime: number;
    lastError: string | null;
    lastSuccessfulOperation: string | null;
  } {
    return {
      errorCount: this.errorCount,
      requestCount: this.requestCount,
      scrapingAttempts: this.scrapingAttempts,
      successfulScrapes: this.successfulScrapes,
      failedScrapes: this.scrapingAttempts - this.successfulScrapes,
      notificationsSent: this.notificationsSent,
      successfulNotifications: this.successfulNotifications,
      failedNotifications: this.notificationsSent - this.successfulNotifications,
      averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      lastError: this.lastError,
      lastSuccessfulOperation: this.lastSuccessfulOperation,
    };
  }

  resetMetrics(): void {
    this.errorCount = 0;
    this.requestCount = 0;
    this.scrapingAttempts = 0;
    this.successfulScrapes = 0;
    this.notificationsSent = 0;
    this.successfulNotifications = 0;
    this.totalResponseTime = 0;
    this.lastError = null;
    this.lastSuccessfulOperation = null;
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    logger.info({ metrics }, 'Application metrics');
  }
}

// Create metrics instance
export const metrics = new Metrics();

/**
 * Create a child logger with additional context
 */
export function createContextLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Log an error with proper handling
 */
export function logError(error: unknown, message: string, context?: Record<string, unknown>): void {
  const errorInfo = extractErrorInfo(error);
  const logContext = {
    ...context,
    error: errorInfo,
  };

  metrics.incrementError();
  logger.error(logContext, message);
}

/**
 * Log an HTTP request
 */
export function logHttpRequest(
  method: string,
  url: string,
  statusCode?: number,
  responseTime?: number,
  context?: Record<string, unknown>
): void {
  const logContext = {
    ...context,
    http: {
      method,
      url,
      statusCode,
      responseTime,
    },
  };

  metrics.incrementRequest();
  if (responseTime) {
    metrics.addResponseTime(responseTime);
  }

  if (statusCode && statusCode >= 400) {
    logger.warn(logContext, `HTTP ${method} ${url} returned ${statusCode}`);
  } else {
    logger.info(logContext, `HTTP ${method} ${url}`);
  }
}

/**
 * Log a scraping attempt
 */
export function logScrapingAttempt(success: boolean, url: string, context?: Record<string, unknown>): void {
  const logContext = {
    ...context,
    scraping: {
      url,
      success,
    },
  };

  metrics.incrementScrapingAttempt();
  if (success) {
    metrics.incrementSuccessfulScrape();
    logger.info(logContext, 'Scraping successful');
  } else {
    logger.warn(logContext, 'Scraping failed');
  }
}

/**
 * Log a notification attempt
 */
export function logNotificationAttempt(success: boolean, context?: Record<string, unknown>): void {
  const logContext = {
    ...context,
    notification: {
      success,
    },
  };

  metrics.incrementNotificationSent();
  if (success) {
    metrics.incrementSuccessfulNotification();
    logger.info(logContext, 'Notification sent successfully');
  } else {
    logger.warn(logContext, 'Notification failed');
  }
}

/**
 * Log application startup
 */
export function logStartup(): void {
  logger.info({
    config: {
      nodeEnv: config.NODE_ENV,
      logLevel: config.LOG_LEVEL,
      patchNotesUrl: config.LOL_PATCH_NOTES_URL,
      checkInterval: `${config.CHECK_INTERVAL_MINUTES} minutes`,
    },
  }, 'Application starting');
}

/**
 * Log application shutdown
 */
export function logShutdown(reason?: string): void {
  metrics.logMetrics();
  logger.info({ reason }, 'Application shutting down');
}

/**
 * Log health check information
 */
export function logHealthCheck(health: Record<string, unknown>): void {
  logger.info({ health }, 'Health check');
}

/**
 * Log circuit breaker state change
 */
export function logCircuitBreakerStateChange(
  oldState: string,
  newState: string,
  reason?: string,
  context?: Record<string, unknown>
): void {
  const logContext = {
    ...context,
    circuitBreaker: {
      oldState,
      newState,
      reason,
    },
  };

  if (newState === 'OPEN') {
    logger.warn(logContext, 'Circuit breaker opened');
  } else if (newState === 'CLOSED') {
    logger.info(logContext, 'Circuit breaker closed');
  } else {
    logger.info(logContext, 'Circuit breaker state changed');
  }
}

// Export the default logger
export default logger;