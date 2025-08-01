/**
 * Logger utility
 * Winston-based logging system with structured output
 */

import winston from 'winston';
import path from 'path';

/**
 * Create winston logger instance
 */
function createLogger(): winston.Logger {
  // Import config here to avoid circular dependency and timing issues
  const { config } = require('../config');

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      const levelMap: Record<string, string> = {
        error: 'ERR',
        warn: 'WRN',
        info: 'INF',
        debug: 'DBG',
      };
      const shortLevel = levelMap[level] || level.substring(0, 3).toUpperCase();
      return `[${timestamp} ${shortLevel}] ${message}${stack ? `\n${  stack}` : ''}`;
    })
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
  ];

  // Add file transport if configured
  if (config.logging.filePath) {
    const logDir = path.dirname(config.logging.filePath);

    transports.push(
      new winston.transports.File({
        filename: config.logging.filePath,
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }

  return winston.createLogger({
    level: config.logging.level,
    transports,
    exitOnError: false,
  });
}

// Lazy logger instance creation
let _logger: winston.Logger | null = null;
function getLogger(): winston.Logger {
  if (!_logger) {
    _logger = createLogger();
  }
  return _logger;
}

/**
 * Logger class with typed methods
 */
export class Logger {
  public static info(message: string, meta?: unknown): void {
    getLogger().info(message, meta);
  }

  public static error(message: string, error?: Error | unknown): void {
    if (error instanceof Error) {
      getLogger().error(message, { error: error.message, stack: error.stack });
    } else {
      getLogger().error(message, { error });
    }
  }

  public static warn(message: string, meta?: unknown): void {
    getLogger().warn(message, meta);
  }

  public static debug(message: string, meta?: unknown): void {
    getLogger().debug(message, meta);
  }
}

// Export the logger instance for direct use
export default getLogger();
