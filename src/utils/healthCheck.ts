/**
 * Health check utilities for monitoring and diagnostics
 */

import { config } from '../config/index.js';
import { APP_CONFIG } from '../core/constants.js';
import { createContextLogger } from './logger.js';
import app from '../app.js';

const logger = createContextLogger({ component: 'healthCheck' });

/**
 * Comprehensive health check function
 */
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  details: {
    application: any;
    monitor: any;
    health: any;
  };
}> {
  const startTime = Date.now();
  
  try {
    const status = await app.getStatus();
    const uptime = process.uptime() * 1000; // Convert to milliseconds

    const overallStatus = status.health.status;

    logger.info('Health check completed', { 
      status: overallStatus,
      responseTime: Date.now() - startTime,
    });

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: APP_CONFIG.VERSION,
      environment: config.NODE_ENV,
      uptime,
      details: status,
    };

  } catch (error) {
    logger.error({ error }, 'Health check failed');
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: APP_CONFIG.VERSION,
      environment: config.NODE_ENV,
      uptime: process.uptime() * 1000,
      details: {
        application: { error: 'Health check failed' },
        monitor: { error: 'Unable to get status' },
        health: { error: 'Health check not available' },
      },
    };
  }
}

/**
 * Simple health check for basic monitoring
 */
export async function basicHealthCheck(): Promise<{
  status: 'ok' | 'error';
  timestamp: string;
}> {
  try {
    const healthResult = await performHealthCheck();
    
    return {
      status: healthResult.status === 'unhealthy' ? 'error' : 'ok',
      timestamp: healthResult.timestamp,
    };
  } catch {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get application metrics
 */
export async function getMetrics(): Promise<{
  timestamp: string;
  application: {
    name: string;
    version: string;
    environment: string;
    uptime: number;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memory: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  business: any;
}> {
  const status = await app.getStatus();
  
  return {
    timestamp: new Date().toISOString(),
    application: {
      name: APP_CONFIG.NAME,
      version: APP_CONFIG.VERSION,
      environment: config.NODE_ENV,
      uptime: process.uptime() * 1000,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    },
    business: status.monitor.metrics,
  };
}