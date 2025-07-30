/**
 * Custom error classes for the LoL Patch Notification System
 */

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly context?: unknown;
  readonly timestamp: string;

  constructor(message: string, context?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

export class ConfigurationError extends AppError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, context?: unknown) {
    super(`Configuration error: ${message}`, context);
  }
}

export class ScrapingError extends AppError {
  readonly code = 'SCRAPING_ERROR';
  readonly statusCode = 502;

  constructor(message: string, context?: unknown) {
    super(`Scraping failed: ${message}`, context);
  }
}

export class ParsingError extends AppError {
  readonly code = 'PARSING_ERROR';
  readonly statusCode = 502;

  constructor(message: string, context?: unknown) {
    super(`HTML parsing failed: ${message}`, context);
  }
}

export class NotificationError extends AppError {
  readonly code = 'NOTIFICATION_ERROR';
  readonly statusCode = 502;

  constructor(message: string, context?: unknown) {
    super(`Discord notification failed: ${message}`, context);
  }
}

export class StorageError extends AppError {
  readonly code = 'STORAGE_ERROR';
  readonly statusCode = 500;

  constructor(message: string, context?: unknown) {
    super(`Storage operation failed: ${message}`, context);
  }
}

export class NetworkError extends AppError {
  readonly code = 'NETWORK_ERROR';
  readonly statusCode = 502;

  constructor(message: string, context?: unknown) {
    super(`Network request failed: ${message}`, context);
  }
}

export class CircuitBreakerError extends AppError {
  readonly code = 'CIRCUIT_BREAKER_OPEN';
  readonly statusCode = 503;

  constructor(message: string, context?: unknown) {
    super(`Circuit breaker is open: ${message}`, context);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, context?: unknown) {
    super(`Validation failed: ${message}`, context);
  }
}

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;

  constructor(message: string, context?: unknown) {
    super(`Rate limit exceeded: ${message}`, context);
  }
}

export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT_ERROR';
  readonly statusCode = 504;

  constructor(message: string, context?: unknown) {
    super(`Operation timed out: ${message}`, context);
  }
}

/**
 * Utility function to check if an error is an instance of AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Utility function to extract error information safely
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
  context?: unknown;
} {
  if (isAppError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      context: error.context,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    };
  }

  return {
    message: String(error) || 'Unknown error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}