/**
 * HTTP client with circuit breaker, retry logic, and rate limiting
 */

import axios, { 
  type AxiosInstance, 
  type AxiosRequestConfig, 
  type AxiosResponse,
  isAxiosError,
} from 'axios';

import { config } from '../config/index.js';
import { 
  HTTP_CONFIG, 
  RETRY_CONFIG, 
  CIRCUIT_BREAKER_CONFIG,
} from '../core/constants.js';
import { 
  NetworkError, 
  TimeoutError, 
  CircuitBreakerError, 
  RateLimitError,
} from '../core/errors.js';
import { createContextLogger, logHttpRequest, logCircuitBreakerStateChange } from './logger.js';

const logger = createContextLogger({ component: 'httpClient' });

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: number;
  private lastOpenTime?: number;
  private successCount = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly monitoringPeriodMs: number;

  constructor() {
    this.failureThreshold = config.CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    this.resetTimeoutMs = config.CIRCUIT_BREAKER_RESET_TIMEOUT_MS;
    this.monitoringPeriodMs = config.CIRCUIT_BREAKER_MONITORING_PERIOD_MS;

    logger.info('Circuit breaker initialized', {
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeoutMs,
      monitoringPeriodMs: this.monitoringPeriodMs,
    });
  }

  canExecute(): boolean {
    const now = Date.now();

    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      if (this.lastOpenTime && (now - this.lastOpenTime) >= this.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN', 'Reset timeout reached');
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= CIRCUIT_BREAKER_CONFIG.DEFAULTS.SUCCESS_THRESHOLD_HALF_OPEN) {
        this.transitionTo('CLOSED', 'Success threshold reached in half-open state');
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      this.reset();
    }
  }

  onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN', 'Failure in half-open state');
      this.lastOpenTime = Date.now();
    } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN', 'Failure threshold exceeded');
      this.lastOpenTime = Date.now();
    }
  }

  getState(): {
    state: string;
    failureCount: number;
    lastFailureTime?: number | undefined;
    lastOpenTime?: number | undefined;
    successCount: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastOpenTime: this.lastOpenTime,
      successCount: this.successCount,
    };
  }

  private transitionTo(newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN', reason: string): void {
    const oldState = this.state;
    this.state = newState;
    logCircuitBreakerStateChange(oldState, newState, reason);
  }

  private reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined as any;
    this.lastOpenTime = undefined as any;
  }
}

/**
 * Rate limiter implementation
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor() {
    this.maxRequests = config.RATE_LIMIT_PER_HOUR;
    this.windowMs = 60 * 60 * 1000; // 1 hour in milliseconds

    logger.info('Rate limiter initialized', {
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
    });
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.cleanOldRequests(now);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    if (!this.canMakeRequest()) {
      throw new RateLimitError('Rate limit exceeded', {
        maxRequests: this.maxRequests,
        windowMs: this.windowMs,
        currentRequests: this.requests.length,
      });
    }
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.cleanOldRequests(now);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  private cleanOldRequests(now: number): void {
    this.requests = this.requests.filter(timestamp => (now - timestamp) < this.windowMs);
  }
}

/**
 * HTTP client with resilience patterns
 */
export class HttpClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: RateLimiter;

  constructor() {
    this.circuitBreaker = new CircuitBreaker();
    this.rateLimiter = new RateLimiter();

    this.axiosInstance = axios.create({
      timeout: config.REQUEST_TIMEOUT_MS,
      headers: HTTP_CONFIG.DEFAULT_HEADERS,
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Don't throw for 4xx errors
    });

    this.setupInterceptors();
    logger.info('HTTP client initialized', {
      timeout: config.REQUEST_TIMEOUT_MS,
      maxRetries: config.MAX_RETRIES,
    });
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async request<T = any>(requestConfig: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    if (!this.circuitBreaker.canExecute()) {
      throw new CircuitBreakerError('Circuit breaker is open', {
        circuitBreakerState: this.circuitBreaker.getState(),
      });
    }

    this.rateLimiter.recordRequest();

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.MAX_RETRIES; attempt++) {
      try {
        const response = await this.axiosInstance.request<T>(requestConfig);
        const responseTime = Date.now() - startTime;

        this.circuitBreaker.onSuccess();
        logHttpRequest(
          requestConfig.method?.toUpperCase() || 'GET',
          requestConfig.url || '',
          response.status,
          responseTime,
          { attempt: attempt + 1 }
        );

        return response;
      } catch (error) {
        lastError = this.handleRequestError(error);
        
        const responseTime = Date.now() - startTime;
        logHttpRequest(
          requestConfig.method?.toUpperCase() || 'GET',
          requestConfig.url || '',
          isAxiosError(error) ? error.response?.status : undefined,
          responseTime,
          { attempt: attempt + 1, error: lastError.message }
        );

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt === config.MAX_RETRIES || !this.isRetryableError(error)) {
          this.circuitBreaker.onFailure();
          break;
        }

        // Wait before retry with exponential backoff
        const delay = this.calculateRetryDelay(attempt);
        logger.debug('Retrying request', { 
          attempt: attempt + 1, 
          maxRetries: config.MAX_RETRIES, 
          delay 
        });
        await this.delay(delay);
      }
    }

    this.circuitBreaker.onFailure();
    throw lastError;
  }

  getCircuitBreakerState(): ReturnType<CircuitBreaker['getState']> {
    return this.circuitBreaker.getState();
  }

  getRemainingRequests(): number {
    return this.rateLimiter.getRemainingRequests();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Making HTTP request', {
          method: config.method,
          url: config.url,
          headers: config.headers,
        });
        return config;
      },
      (error) => {
        logger.error({ error }, 'Request interceptor error');
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('Received HTTP response', {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
        return response;
      },
      (error) => {
        logger.debug('Received HTTP error response', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  private handleRequestError(error: unknown): Error {
    if (isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return new TimeoutError('Request timeout', {
          timeout: config.REQUEST_TIMEOUT_MS,
          originalError: error,
        });
      }

      if (error.response) {
        return new NetworkError(
          `HTTP ${error.response.status}: ${error.response.statusText}`,
          {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          }
        );
      }

      return new NetworkError('Network request failed', {
        code: error.code,
        message: error.message,
      });
    }

    if (error instanceof Error) {
      return new NetworkError(`Request failed: ${error.message}`, { originalError: error });
    }

    return new NetworkError('Unknown request error', { error });
  }

  private isRetryableError(error: unknown): boolean {
    if (isAxiosError(error)) {
      // Retry on network errors
      if (!error.response) {
        return true;
      }

      // Retry on specific status codes
      const status = error.response.status;
      return RETRY_CONFIG.RETRYABLE_STATUS_CODES.includes(status as any);
    }

    return false;
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt);
    const maxDelay = RETRY_CONFIG.MAX_DELAY_MS;
    const jitter = baseDelay * RETRY_CONFIG.JITTER_FACTOR * Math.random();
    
    return Math.min(baseDelay + jitter, maxDelay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create and export singleton instance
export const httpClient = new HttpClient();