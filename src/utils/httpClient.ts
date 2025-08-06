/**
 * HTTP Client utility
 * Axios-based HTTP client with retry logic and rate limiting
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { config } from '../config/config';
import { Logger } from './logger';
import { type HttpResponse, NetworkError } from '../types/types';

/**
 * Rate limiter for HTTP requests
 */
class RateLimiter {
  private requests: number[] = [];

  public canMakeRequest(): boolean {
    const now = Date.now();
    const windowStart = now - config.rateLimit.windowMs;

    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > windowStart);

    // Check if we can make another request
    return this.requests.length < config.rateLimit.maxRequestsPerHour;
  }

  public recordRequest(): void {
    this.requests.push(Date.now());
  }
}

/**
 * HTTP Client class with built-in retry and rate limiting
 */
export class HttpClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly rateLimiter = new RateLimiter();

  // HTTP Status codes
  private static readonly HTTP_STATUS_TOO_MANY_REQUESTS = 429;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: config.http.timeout,
      headers: {
        'User-Agent': 'LoL-Patch-Notifier/1.0.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  }

  /**
   * Make HTTP GET request with retry logic
   */
  public get<T = string>(url: string, options?: AxiosRequestConfig): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('GET', url, options);
  }

  /**
   * Make HTTP POST request with retry logic
   */
  public post<T = unknown>(
    url: string,
    data?: unknown,
    options?: AxiosRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('POST', url, { ...options, data });
  } /**
   * Make HTTP request with retry logic and rate limiting
   */
  private async makeRequest<T>(
    method: string,
    url: string,
    options?: AxiosRequestConfig
  ): Promise<HttpResponse<T>> {
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      throw new NetworkError(
        'Rate limit exceeded. Please try again later.',
        HttpClient.HTTP_STATUS_TOO_MANY_REQUESTS
      );
    }

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.http.maxRetries; attempt++) {
      try {
        Logger.debug(`Making ${method} request to ${url} (attempt ${attempt})`);

        this.rateLimiter.recordRequest();

        const response: AxiosResponse<T> = await this.axiosInstance.request({
          method,
          url,
          ...options,
        });

        Logger.debug(`${method} request to ${url} successful (${response.status})`);

        return {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers as Record<string, string>,
        };
      } catch (error) {
        lastError = error as Error;
        Logger.warn(
          `${method} request to ${url} failed (attempt ${attempt}): ${lastError.message}`
        );

        if (attempt < config.http.maxRetries) {
          const delay = config.http.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          Logger.debug(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    const errorMessage = `Failed to ${method} ${url} after ${config.http.maxRetries} attempts`;
    Logger.error(errorMessage, lastError);
    throw new NetworkError(
      errorMessage,
      axios.isAxiosError(lastError) ? lastError.response?.status : undefined
    );
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export default instance
export const httpClient = new HttpClient();
