/**
 * Logger utility
 * Winston-based logging system with enhanced formatting and ESM support
 */

import winston from 'winston';
import path from 'path';

// Use process.cwd() for base directory instead of import.meta
const projectRoot = process.cwd();

const logLevel = process.env.LOG_LEVEL ?? 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module, ...metadata }) => {
    // ログレベルを3文字の短縮形に変換し色付け
    const levelColorMap: Record<string, { short: string; color: string }> = {
      error: { short: 'ERR', color: '\x1b[31m' }, // 赤
      warn: { short: 'WRN', color: '\x1b[33m' }, // 黄
      info: { short: 'INF', color: '\x1b[36m' }, // シアン
      debug: { short: 'DBG', color: '\x1b[35m' }, // マゼンタ
      verbose: { short: 'VRB', color: '\x1b[34m' }, // 青
      silly: { short: 'SIL', color: '\x1b[37m' }, // 白
    };

    const levelInfo = levelColorMap[level] ?? {
      short: level.substring(0, 3).toUpperCase(),
      color: '\x1b[37m',
    };
    const reset = '\x1b[0m';
    const timeColor = '\x1b[90m'; // グレー

    let msg = `${timeColor}[${timestamp}${reset} ${levelInfo.color}${levelInfo.short}${reset}]`;

    // モジュール名がある場合は表示
    if (module) {
      const moduleColor = '\x1b[90m'; // グレー
      msg += ` ${moduleColor}[${module}]${reset}`;
    }

    msg += ` ${message}`;

    // メタデータがある場合は表示
    const filteredMetadata = { ...metadata };
    delete filteredMetadata.service; // serviceは表示しない
    if (Object.keys(filteredMetadata).length > 0) {
      const metadataColor = '\x1b[90m'; // グレー
      msg += ` ${metadataColor}${JSON.stringify(filteredMetadata)}${reset}`;
    }
    return msg;
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'lol-patch-notifier' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(projectRoot, 'logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for combined logs
    new winston.transports.File({
      filename: path.join(projectRoot, 'logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Create a child logger for specific modules
export const createLogger = (module: string): winston.Logger => logger.child({ module });

/**
 * Logger class with typed methods for backward compatibility
 */
export class Logger {
  public static info(message: string, meta?: unknown): void {
    logger.info(message, meta);
  }

  public static error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack });
    } else if (error !== undefined) {
      logger.error(message, { error: String(error) });
    } else {
      logger.error(message);
    }
  }

  public static warn(message: string, meta?: unknown): void {
    logger.warn(message, meta);
  }

  public static debug(message: string, meta?: unknown): void {
    logger.debug(message, meta);
  }

  public static verbose(message: string, meta?: unknown): void {
    logger.verbose(message, meta);
  }

  public static silly(message: string, meta?: unknown): void {
    logger.silly(message, meta);
  }
}

// Export the logger instance for direct use
export default logger;
