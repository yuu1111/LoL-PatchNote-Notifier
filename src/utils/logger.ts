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
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
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
      const shortLevel = levelMap[level] ?? level.substring(0, 3).toUpperCase();
      const logLine = `[${String(timestamp)}  ${shortLevel}] ${String(message)}`;
      return stack ? `${logLine}\n${String(stack)}` : logLine;
    })
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(logFormat, winston.format.colorize({ all: true })),
    }),
  ];

  // Add file transport if configured
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (config.logging.filePath) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const _logDir = path.dirname(config.logging.filePath); // ディレクトリ情報（将来的に使用予定）

    transports.push(
      new winston.transports.File({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        filename: config.logging.filePath,
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }

  return winston.createLogger({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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

  public static error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      getLogger().error(message, { error: error.message, stack: error.stack });
    } else if (error !== undefined) {
      getLogger().error(message, { error: String(error) });
    } else {
      getLogger().error(message);
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
