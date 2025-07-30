/**
 * Main application entry point with interval scheduling and graceful shutdown
 */

import { config } from './config/index.js';
import { 
  logStartup, 
  logShutdown, 
  logError, 
  createContextLogger,
} from './utils/logger.js';
import { PatchMonitor } from './services/PatchMonitor.js';

const logger = createContextLogger({ component: 'app' });

/**
 * Main application class
 */
class Application {
  private patchMonitor: PatchMonitor;
  private intervalId: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    this.patchMonitor = new PatchMonitor();
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting LoL Patch Notifier application');
      logStartup();

      // Initialize patch monitor
      await this.patchMonitor.initialize();

      // Perform initial check
      logger.info('Performing initial patch check');
      const initialResult = await this.patchMonitor.checkAndNotify();
      
      if (initialResult.success) {
        if (initialResult.newPatchFound) {
          logger.info('Initial check found new patch', {
            patch: initialResult.patchInfo?.title,
          });
        } else {
          logger.info('Initial check completed, no new patches');
        }
      } else {
        logger.warn('Initial check failed', { error: initialResult.error });
      }

      // Start interval scheduler
      this.startScheduler();

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

      logger.info('Application started successfully', {
        checkIntervalMinutes: config.CHECK_INTERVAL_MINUTES,
        nodeEnv: config.NODE_ENV,
      });

    } catch (error) {
      logError(error, 'Failed to start application');
      process.exit(1);
    }
  }

  /**
   * Start the interval scheduler
   */
  private startScheduler(): void {
    const intervalMs = config.CHECK_INTERVAL_MINUTES * 60 * 1000;
    
    logger.info('Starting interval scheduler', {
      intervalMinutes: config.CHECK_INTERVAL_MINUTES,
      intervalMs,
    });

    // Validate interval
    if (config.CHECK_INTERVAL_MINUTES < 1 || config.CHECK_INTERVAL_MINUTES > 1440) {
      throw new Error(`Invalid check interval: ${config.CHECK_INTERVAL_MINUTES} minutes (must be 1-1440)`);
    }

    this.intervalId = setInterval(async () => {
      if (this.isShuttingDown) {
        logger.warn('Skipping scheduled check due to shutdown in progress');
        return;
      }

      await this.performScheduledCheck();
    }, intervalMs);

    logger.info('Interval scheduler started successfully', {
      nextCheckIn: `${config.CHECK_INTERVAL_MINUTES} minutes`,
    });
  }

  /**
   * Perform a scheduled patch check
   */
  private async performScheduledCheck(): Promise<void> {
    const contextLogger = logger.child({ operation: 'scheduledCheck' });
    
    try {
      contextLogger.info('Starting scheduled patch check');
      
      const result = await this.patchMonitor.checkAndNotify();
      
      if (result.success) {
        if (result.newPatchFound) {
          contextLogger.info('Scheduled check found new patch', {
            patch: result.patchInfo?.title,
            url: result.patchInfo?.url,
          });
        } else {
          contextLogger.info('Scheduled check completed, no new patches');
        }
      } else {
        contextLogger.error('Scheduled check failed', { 
          error: result.error,
        });
      }

    } catch (error) {
      logError(error, 'Unexpected error during scheduled check');
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdownHandler = (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      this.shutdown(signal);
    };

    // Handle termination signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logError(error, 'Uncaught exception occurred');
      this.shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logError(reason, 'Unhandled promise rejection', { promise });
      this.shutdown('unhandledRejection');
    });

    logger.debug('Shutdown handlers setup completed');
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(reason: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown', { reason });

    const shutdownTimeout = setTimeout(() => {
      logger.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout

    try {
      // Stop interval scheduler
      if (this.intervalId) {
        logger.info('Stopping interval scheduler');
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      // Cleanup patch monitor
      await this.patchMonitor.cleanup();

      // Clear shutdown timeout
      clearTimeout(shutdownTimeout);

      logShutdown(reason);
      logger.info('Graceful shutdown completed successfully');

      process.exit(0);

    } catch (error) {
      clearTimeout(shutdownTimeout);
      logError(error, 'Error during graceful shutdown');
      process.exit(1);
    }
  }

  /**
   * Get application status (for health checks)
   */
  async getStatus(): Promise<{
    application: {
      isRunning: boolean;
      isShuttingDown: boolean;
      checkIntervalMinutes: number;
      schedulerRunning: boolean;
    };
    monitor: Awaited<ReturnType<PatchMonitor['getStatus']>>;
    health: Awaited<ReturnType<PatchMonitor['healthCheck']>>;
  }> {
    const [monitorStatus, health] = await Promise.all([
      this.patchMonitor.getStatus(),
      this.patchMonitor.healthCheck(),
    ]);

    return {
      application: {
        isRunning: !this.isShuttingDown,
        isShuttingDown: this.isShuttingDown,
        checkIntervalMinutes: config.CHECK_INTERVAL_MINUTES,
        schedulerRunning: !!this.intervalId,
      },
      monitor: monitorStatus,
      health,
    };
  }

  /**
   * Force a patch check (for manual testing)
   */
  async forceCheck(): Promise<Awaited<ReturnType<PatchMonitor['checkAndNotify']>>> {
    logger.info('Manual patch check requested');
    return await this.patchMonitor.checkAndNotify();
  }

  /**
   * Force send notification (for testing)
   */
  async forceNotification(): Promise<Awaited<ReturnType<PatchMonitor['forceNotification']>>> {
    logger.info('Manual notification requested');
    return await this.patchMonitor.forceNotification();
  }
}

// Create application instance
const app = new Application();

// Export for testing
export { Application };

// Start application if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app.start().catch((error) => {
    logError(error, 'Application startup failed');
    process.exit(1);
  });
}

// Export app instance for testing
export default app;