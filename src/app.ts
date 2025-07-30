/**
 * Main application entry point with interval scheduling and graceful shutdown
 */

import { pathToFileURL } from 'url';
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
      logger.info('🚀 Starting LoL Patch Notifier application', {
        processId: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
      });
      logStartup();

      // Initialize patch monitor
      logger.info('Initializing patch monitor...');
      await this.patchMonitor.initialize();
      logger.info('Patch monitor initialization completed');

      // Perform initial check using the same logic as scheduled checks
      logger.info('🔄 Performing startup patch check...');
      
      try {
        const initialResult = await this.performSinglePatchCheck('startup');
        
        if (initialResult.success) {
          if (initialResult.newPatchFound) {
            logger.info('🎉 New patch found during startup - notification sent', {
              patch: initialResult.patchInfo?.title,
            });
          } else {
            logger.info('✅ System is up to date', {
              currentPatch: initialResult.patchInfo?.title || 'Unknown',
            });
          }
        } else {
          logger.warn('⚠️ Startup check failed - will retry on next scheduled run', { 
            error: initialResult.error 
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('⚠️ Startup check failed - scheduled checks will continue', { 
          error: errorMessage,
        });
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
   * Perform a single patch check operation (shared by startup and scheduled checks)
   */
  private async performSinglePatchCheck(context: 'startup' | 'scheduled'): Promise<Awaited<ReturnType<PatchMonitor['checkAndNotify']>>> {
    const contextLogger = logger.child({ 
      operation: 'performSinglePatchCheck',
      context,
    });
    
    contextLogger.info(`🔍 Starting ${context} patch check`);
    
    const result = await this.patchMonitor.checkAndNotify();
    
    contextLogger.info(`✅ ${context} patch check completed`, {
      success: result.success,
      newPatchFound: result.newPatchFound,
      patch: result.patchInfo?.title || 'None',
    });
    
    return result;
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
    try {
      await this.performSinglePatchCheck('scheduled');
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
// Fix for Windows path handling in ESM
const currentModuleUrl = import.meta.url;
const scriptPath = process.argv[1];

if (scriptPath) {
  const mainModuleUrl = pathToFileURL(scriptPath).href;
  
  if (currentModuleUrl === mainModuleUrl) {
    app.start().catch((error) => {
      logError(error, 'Application startup failed');
      process.exit(1);
    });
  }
}

// Export app instance for testing
export default app;