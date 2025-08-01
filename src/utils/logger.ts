/**
 * Logger utility
 * Winston-based logging system with structured output
 */

import winston from 'winston';
import path from 'path';
import { config } from '../config';

/**
 * Create winston logger instance
 */
function createLogger(): winston.Logger {
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${stack ? '\n' + stack : ''}`;
    })
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
  ];

  // Add file transport if configured
  if (config.logging.filePath) {    const logDir = path.dirname(config.logging.filePath);
    
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

// Create global logger instance
const logger = createLogger();

/**
 * Logger class with typed methods
 */
export class Logger {
  public static info(message: string, meta?: unknown): void {
    logger.info(message, meta);
  }

  public static error(message: string, error?: Error | unknown): void {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack });
    } else {
      logger.error(message, { error });
    }
  }

  public static warn(message: string, meta?: unknown): void {
    logger.warn(message, meta);
  }

  public static debug(message: string, meta?: unknown): void {
    logger.debug(message, meta);
  }
}

// Export the logger instance for direct use
export default logger;