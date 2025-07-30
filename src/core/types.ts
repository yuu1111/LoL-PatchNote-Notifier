/**
 * Core type definitions for the LoL Patch Notification System
 */

export interface PatchInfo {
  /** Patch title extracted from the LoL website (e.g., "パッチ 14.13 ノート") */
  title: string;
  /** Absolute URL to the patch notes page */
  url: string;
  /** Timestamp when the patch was discovered */
  discoveredAt?: string | undefined;
}

export interface LastStatus {
  /** URL of the last patch that was successfully notified */
  lastNotifiedUrl: string;
  /** Timestamp when the last notification was sent */
  lastNotifiedAt: string;
  /** Title of the last notified patch for reference */
  lastNotifiedTitle?: string | undefined;
}

export interface DiscordEmbed {
  /** Title of the embed */
  title: string;
  /** URL associated with the embed */
  url: string;
  /** Description text */
  description: string;
  /** Color in decimal format (e.g., 5814783 for Discord purple) */
  color: number;
  /** ISO 8601 timestamp string */
  timestamp?: string | undefined;
  /** Footer information */
  footer?: {
    text: string;
    icon_url?: string | undefined;
  } | undefined;
  /** Thumbnail information */
  thumbnail?: {
    url: string;
  } | undefined;
}

export interface DiscordWebhookPayload {
  /** Main content text (supports @everyone, @here mentions) */
  content?: string | undefined;
  /** Array of rich embeds */
  embeds?: DiscordEmbed[] | undefined;
  /** Username override for the webhook */
  username?: string | undefined;
  /** Avatar URL override for the webhook */
  avatar_url?: string | undefined;
}

export interface ScrapingResult {
  /** Successfully extracted patch information */
  patchInfo: PatchInfo | null;
  /** Whether the scraping operation was successful */
  success: boolean;
  /** Error message if scraping failed */
  error?: string;
  /** HTTP status code from the request */
  statusCode?: number;
  /** Response time in milliseconds */
  responseTime?: number;
}

export interface NotificationResult {
  /** Whether the notification was sent successfully */
  success: boolean;
  /** Error message if notification failed */
  error?: string;
  /** HTTP status code from Discord webhook response */
  statusCode?: number;
  /** Response time in milliseconds */
  responseTime?: number;
}

export interface CircuitBreakerState {
  /** Current state of the circuit breaker */
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  /** Number of consecutive failures */
  failureCount: number;
  /** Timestamp of the last failure */
  lastFailureTime?: number | undefined;
  /** Timestamp when the circuit breaker was last opened */
  lastOpenTime?: number | undefined;
  /** Number of successful requests since last reset */
  successCount: number;
}

export interface HealthCheck {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Timestamp of the health check */
  timestamp: string;
  /** Service uptime in milliseconds */
  uptime: number;
  /** Details of individual component health */
  components: {
    storage: 'healthy' | 'unhealthy';
    httpClient: 'healthy' | 'unhealthy';
    circuitBreaker: 'healthy' | 'unhealthy';
  };
  /** Metrics data */
  metrics?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  };
}

export interface ApplicationMetrics {
  /** Total number of scraping attempts */
  scrapingAttempts: number;
  /** Number of successful scraping operations */
  successfulScrapes: number;
  /** Number of failed scraping operations */
  failedScrapes: number;
  /** Total number of notifications sent */
  notificationsSent: number;
  /** Number of successful notifications */
  successfulNotifications: number;
  /** Number of failed notifications */
  failedNotifications: number;
  /** Average response time for HTTP requests */
  averageResponseTime: number;
  /** Last successful operation timestamp */
  lastSuccessfulOperation?: string;
  /** Last error timestamp */
  lastError?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type Environment = 'development' | 'staging' | 'production';
export type StorageType = 'file' | 'redis' | 'memory';