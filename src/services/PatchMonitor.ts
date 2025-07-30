/**
 * Main application service that coordinates patch monitoring and notifications
 */

import { lastStatusSchema } from '../config/schemas.js';
import { STORAGE_CONFIG } from '../core/constants.js';
import {
  StorageError,
  AppError,
} from '../core/errors.js';
import { type LastStatus, type PatchInfo, type HealthCheck } from '../core/types.js';
import {
  createContextLogger,
  logError,
  metrics,
} from '../utils/logger.js';
import { createStorage, type IStorage } from '../utils/storage.js';
import { httpClient } from '../utils/httpClient.js';

import { PatchScraper } from './PatchScraper.js';
import { DiscordNotifier } from './DiscordNotifier.js';
import { PatchCacheService } from './PatchCacheService.js';

const logger = createContextLogger({ component: 'patchMonitor' });

/**
 * Main application service that orchestrates patch monitoring
 */
export class PatchMonitor {
  private readonly patchScraper: PatchScraper;
  private readonly discordNotifier: DiscordNotifier;
  private readonly patchCache: PatchCacheService;
  private readonly storage: IStorage;
  private isRunning = false;
  private lastStatus: LastStatus | null = null;

  constructor() {
    this.patchScraper = new PatchScraper();
    this.discordNotifier = new DiscordNotifier();
    this.patchCache = new PatchCacheService();
    this.storage = createStorage();

    logger.info('Patch monitor initialized');
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    const contextLogger = logger.child({ operation: 'initialize' });

    try {
      contextLogger.info('Initializing patch monitor');

      // Initialize patch cache service
      contextLogger.info('Initializing patch cache service');
      await this.patchCache.initialize();
      contextLogger.info('Patch cache service initialization completed');

      // Load last status from storage
      contextLogger.info('Loading last status from storage');
      await this.loadLastStatus();
      contextLogger.info('Last status loading completed');

      // Skip webhook connectivity test during initialization to avoid blocking
      contextLogger.info('Webhook connectivity test skipped during initialization');

      const cacheStats = this.patchCache.getCacheStats();
      contextLogger.info('Patch monitor initialization completed', {
        hasLastStatus: !!this.lastStatus,
        lastNotifiedUrl: this.lastStatus?.lastNotifiedUrl || 'none',
        cachedPatches: cacheStats.totalPatches,
      });

    } catch (error) {
      logError(error, 'Failed to initialize patch monitor');
      throw error;
    }
  }

  /**
   * Check for new patches and send notifications if found
   */
  async checkAndNotify(): Promise<{
    success: boolean;
    newPatchFound: boolean;
    patchInfo?: PatchInfo;
    error?: string;
  }> {
    const contextLogger = logger.child({ operation: 'checkAndNotify' });

    if (this.isRunning) {
      contextLogger.warn('Check already in progress, skipping');
      return {
        success: false,
        newPatchFound: false,
        error: 'Check already in progress',
      };
    }

    this.isRunning = true;

    try {
      contextLogger.info('Starting patch check');

      // Scrape the latest patch information with detailed content
      const patchInfo = await this.patchScraper.getDetailedPatchInfo();

      if (!patchInfo) {
        contextLogger.warn('No patch information found');
        return {
          success: true,
          newPatchFound: false,
        };
      }

      contextLogger.info('Latest patch found', {
        title: patchInfo.title,
        url: patchInfo.url,
      });

      // Cache the retrieved patch
      try {
        await this.patchCache.addPatch(patchInfo);
        contextLogger.debug('Patch added to cache', {
          title: patchInfo.title,
          totalCached: this.patchCache.getCacheStats().totalPatches,
        });
      } catch (error) {
        // Log cache error but don't fail the entire operation
        logError(error, 'Failed to cache patch info', { patchInfo });
      }

      // Check if this is a new patch
      const isNewPatch = this.isNewPatch(patchInfo);

      if (!isNewPatch) {
        contextLogger.info('No new patch found', {
          currentPatch: patchInfo.title,
          lastNotified: this.lastStatus?.lastNotifiedTitle || 'none',
        });

        return {
          success: true,
          newPatchFound: false,
          patchInfo,
        };
      }

      contextLogger.info('New patch detected, sending notification', {
        newPatch: patchInfo.title,
        previousPatch: this.lastStatus?.lastNotifiedTitle || 'none',
      });

      // Send Discord notification
      await this.discordNotifier.sendPatchNotification(patchInfo);

      // Update last status
      await this.updateLastStatus(patchInfo);

      contextLogger.info('Patch notification completed successfully', {
        patch: patchInfo.title,
      });

      return {
        success: true,
        newPatchFound: true,
        patchInfo,
      };

    } catch (error) {
      logError(error, 'Patch check and notification failed');

      return {
        success: false,
        newPatchFound: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Force send a notification for the current patch (for testing)
   */
  async forceNotification(): Promise<{
    success: boolean;
    patchInfo?: PatchInfo;
    error?: string;
  }> {
    const contextLogger = logger.child({ operation: 'forceNotification' });

    try {
      contextLogger.info('Force notification requested');

      const patchInfo = await this.patchScraper.getDetailedPatchInfo();

      if (!patchInfo) {
        return {
          success: false,
          error: 'No patch information found',
        };
      }

      // Cache the patch
      try {
        await this.patchCache.addPatch(patchInfo);
        contextLogger.debug('Patch added to cache during force notification', {
          title: patchInfo.title,
        });
      } catch (error) {
        logError(error, 'Failed to cache patch info during force notification', { patchInfo });
      }

      await this.discordNotifier.sendPatchNotification(patchInfo);
      await this.updateLastStatus(patchInfo);

      contextLogger.info('Force notification completed', {
        patch: patchInfo.title,
      });

      return {
        success: true,
        patchInfo,
      };

    } catch (error) {
      logError(error, 'Force notification failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get current application status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    lastStatus: LastStatus | null;
    scraperCache: ReturnType<PatchScraper['getCacheStatus']>;
    patchCache: ReturnType<PatchCacheService['getCacheStats']>;
    circuitBreakerState: ReturnType<typeof httpClient.getCircuitBreakerState>;
    webhookInfo: ReturnType<DiscordNotifier['getWebhookInfo']>;
    metrics: ReturnType<typeof metrics.getMetrics>;
  }> {
    return {
      isRunning: this.isRunning,
      lastStatus: this.lastStatus,
      scraperCache: this.patchScraper.getCacheStatus(),
      patchCache: this.patchCache.getCacheStats(),
      circuitBreakerState: httpClient.getCircuitBreakerState(),
      webhookInfo: this.discordNotifier.getWebhookInfo(),
      metrics: metrics.getMetrics(),
    };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    const contextLogger = logger.child({ operation: 'healthCheck' });

    try {
      const components: {
        storage: 'healthy' | 'unhealthy';
        httpClient: 'healthy' | 'unhealthy';
        circuitBreaker: 'healthy' | 'unhealthy';
      } = {
        storage: 'healthy',
        httpClient: 'healthy',
        circuitBreaker: 'healthy',
      };

      // Test storage
      try {
        await this.storage.exists('health_check_test');
        components.storage = 'healthy';
      } catch {
        components.storage = 'unhealthy';
      }

      // Check HTTP client and circuit breaker
      const circuitBreakerState = httpClient.getCircuitBreakerState();
      if (circuitBreakerState.state === 'OPEN') {
        components.circuitBreaker = 'unhealthy';
        components.httpClient = 'unhealthy';
      } else {
        components.circuitBreaker = 'healthy';

        // Test HTTP connectivity
        try {
          const webhookTest = await this.discordNotifier.testWebhookConnectivity();
          components.httpClient = webhookTest.isConnected ? 'healthy' : 'unhealthy';
        } catch {
          components.httpClient = 'unhealthy';
        }
      }

      const overallStatus = Object.values(components).every(status => status === 'healthy') 
        ? 'healthy'
        : Object.values(components).some(status => status === 'healthy')
        ? 'degraded'
        : 'unhealthy';

      const health: HealthCheck = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        components,
        metrics: {
          totalRequests: metrics.getMetrics().requestCount,
          successfulRequests: metrics.getMetrics().successfulScrapes + metrics.getMetrics().successfulNotifications,
          failedRequests: metrics.getMetrics().failedScrapes + metrics.getMetrics().failedNotifications,
          averageResponseTime: metrics.getMetrics().averageResponseTime,
        },
      };

      contextLogger.info('Health check completed', { status: overallStatus });
      return health;

    } catch (error) {
      logError(error, 'Health check failed');

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        components: {
          storage: 'unhealthy' as const,
          httpClient: 'unhealthy' as const,
          circuitBreaker: 'unhealthy' as const,
        },
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    const contextLogger = logger.child({ operation: 'cleanup' });

    try {
      contextLogger.info('Starting cleanup');

      // Clear scraper cache
      this.patchScraper.clearCache();

      // Clean up patch cache service
      await this.patchCache.cleanup();

      // Log final metrics
      metrics.logMetrics();

      contextLogger.info('Cleanup completed successfully');
    } catch (error) {
      logError(error, 'Cleanup failed');
    }
  }

  /**
   * Load last status from storage
   */
  private async loadLastStatus(): Promise<void> {
    const contextLogger = logger.child({ operation: 'loadLastStatus' });

    try {
      this.lastStatus = await this.storage.get(
        STORAGE_CONFIG.LAST_STATUS_KEY,
        lastStatusSchema
      );

      if (this.lastStatus) {
        contextLogger.info('Last status loaded successfully', {
          lastNotifiedUrl: this.lastStatus.lastNotifiedUrl,
          lastNotifiedAt: this.lastStatus.lastNotifiedAt,
        });
      } else {
        contextLogger.info('No previous status found, first run detected');

        // Initialize with empty status
        this.lastStatus = {
          lastNotifiedUrl: '',
          lastNotifiedAt: new Date().toISOString(),
        };

        await this.storage.set(STORAGE_CONFIG.LAST_STATUS_KEY, this.lastStatus);
      }

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new StorageError('Failed to load last status', { error });
    }
  }

  /**
   * Update last status in storage
   */
  private async updateLastStatus(patchInfo: PatchInfo): Promise<void> {
    const contextLogger = logger.child({ operation: 'updateLastStatus' });

    try {
      const newStatus: LastStatus = {
        lastNotifiedUrl: patchInfo.url,
        lastNotifiedAt: new Date().toISOString(),
        lastNotifiedTitle: patchInfo.title,
      };

      await this.storage.set(STORAGE_CONFIG.LAST_STATUS_KEY, newStatus);
      this.lastStatus = newStatus;

      contextLogger.info('Last status updated successfully', {
        lastNotifiedUrl: newStatus.lastNotifiedUrl,
        lastNotifiedTitle: newStatus.lastNotifiedTitle,
      });

    } catch (error) {
      throw new StorageError('Failed to update last status', {
        patchInfo,
        error,
      });
    }
  }

  /**
   * Check if the patch is new compared to the last notified patch
   */
  private isNewPatch(patchInfo: PatchInfo): boolean {
    if (!this.lastStatus || !this.lastStatus.lastNotifiedUrl) {
      return true;
    }

    return patchInfo.url !== this.lastStatus.lastNotifiedUrl;
  }

  /**
   * Check if this is the first run (no previous status or empty URL)
   */
  isFirstRun(): boolean {
    return !this.lastStatus || this.lastStatus.lastNotifiedUrl === '';
  }

  /**
   * Get all cached patches
   */
  getCachedPatches(): ReturnType<PatchCacheService['getAllPatches']> {
    return this.patchCache.getAllPatches();
  }

  /**
   * Get cached patches sorted by discovery date (newest first)
   */
  getCachedPatchesSorted(): ReturnType<PatchCacheService['getPatchesSorted']> {
    return this.patchCache.getPatchesSorted();
  }

  /**
   * Get a specific cached patch by URL
   */
  async getCachedPatch(url: string, includeContent: boolean = false): Promise<ReturnType<PatchCacheService['getPatch']>> {
    return await this.patchCache.getPatch(url, includeContent);
  }

  /**
   * Get a specific cached patch by URL (synchronous, index only)
   */
  getCachedPatchSync(url: string): ReturnType<PatchCacheService['getPatchSync']> {
    return this.patchCache.getPatchSync(url);
  }

  /**
   * Get the latest cached patch
   */
  getLatestCachedPatch(): ReturnType<PatchCacheService['getLatestPatch']> {
    return this.patchCache.getLatestPatch();
  }

}