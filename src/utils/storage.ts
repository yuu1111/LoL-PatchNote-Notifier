/**
 * Storage abstraction with file and Redis implementations
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';

import { config } from '../config/index.js';
import { STORAGE_CONFIG } from '../core/constants.js';
import { StorageError, ValidationError } from '../core/errors.js';
import { createContextLogger, logError } from './logger.js';

const logger = createContextLogger({ component: 'storage' });

/**
 * Abstract storage interface
 */
export interface IStorage {
  get<T>(key: string, schema: z.ZodSchema<T>): Promise<T | null>;
  set<T>(key: string, data: T): Promise<void>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * File-based storage implementation
 */
export class FileStorage implements IStorage {
  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || dirname(config.LAST_STATUS_FILE_PATH);
  }

  async get<T>(key: string, schema: z.ZodSchema<T>): Promise<T | null> {
    const filePath = this.getFilePath(key);
    const contextLogger = logger.child({ operation: 'get', key, filePath });
    
    try {
      contextLogger.debug('Reading file');
      const data = await fs.readFile(filePath, STORAGE_CONFIG.FILE_ENCODING);
      
      contextLogger.debug('Parsing JSON data', { dataLength: data.length });
      const parsed = JSON.parse(data);
      
      contextLogger.debug('Validating data against schema');
      const validated = schema.parse(parsed);
      
      contextLogger.info('File read successfully');
      return validated;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        contextLogger.info('File does not exist');
        return null;
      }

      if (error instanceof z.ZodError) {
        contextLogger.warn({ zodError: error.errors }, 'Data validation failed');
        throw new ValidationError('Storage data validation failed', {
          key,
          errors: error.errors,
        });
      }

      if (error instanceof SyntaxError) {
        contextLogger.warn('JSON parsing failed');
        throw new StorageError('Invalid JSON data in storage', { key, error });
      }

      logError(error, 'File read operation failed', { key, filePath });
      throw new StorageError('File read failed', { key, error });
    }
  }

  async set<T>(key: string, data: T): Promise<void> {
    const filePath = this.getFilePath(key);
    const contextLogger = logger.child({ operation: 'set', key, filePath });
    
    try {
      contextLogger.debug('Ensuring directory exists');
      await this.ensureDirectoryExists(this.basePath);
      
      contextLogger.debug('Serializing data to JSON');
      const jsonData = JSON.stringify(data, null, STORAGE_CONFIG.JSON_INDENT);
      
      contextLogger.debug('Writing file', { dataLength: jsonData.length });
      await fs.writeFile(filePath, jsonData, STORAGE_CONFIG.FILE_ENCODING);
      
      contextLogger.info('File written successfully');
    } catch (error) {
      logError(error, 'File write operation failed', { key, filePath });
      throw new StorageError('File write failed', { key, error });
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    const contextLogger = logger.child({ operation: 'delete', key, filePath });
    
    try {
      await fs.unlink(filePath);
      contextLogger.info('File deleted successfully');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        contextLogger.info('File does not exist, delete skipped');
        return;
      }

      logError(error, 'File delete operation failed', { key, filePath });
      throw new StorageError('File delete failed', { key, error });
    }
  }

  async clear(): Promise<void> {
    const contextLogger = logger.child({ operation: 'clear', basePath: this.basePath });
    
    try {
      contextLogger.debug('Reading directory contents');
      const files = await fs.readdir(this.basePath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      contextLogger.debug('Deleting JSON files', { count: jsonFiles.length });
      await Promise.all(
        jsonFiles.map(file => fs.unlink(`${this.basePath}/${file}`))
      );
      
      contextLogger.info('Storage cleared successfully', { deletedFiles: jsonFiles.length });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        contextLogger.info('Directory does not exist, clear skipped');
        return;
      }

      logError(error, 'Storage clear operation failed');
      throw new StorageError('Storage clear failed', { error });
    }
  }

  private getFilePath(key: string): string {
    return `${this.basePath}/${key}.json`;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new StorageError('Directory creation failed', { dirPath, error });
    }
  }
}

/**
 * In-memory storage implementation (for testing)
 */
export class MemoryStorage implements IStorage {
  private storage = new Map<string, unknown>();
  private readonly contextLogger = logger.child({ storage: 'memory' });

  async get<T>(key: string, schema: z.ZodSchema<T>): Promise<T | null> {
    const data = this.storage.get(key);
    
    if (data === undefined) {
      this.contextLogger.debug('Key not found', { key });
      return null;
    }

    try {
      const validated = schema.parse(data);
      this.contextLogger.debug('Data retrieved successfully', { key });
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.contextLogger.warn({ zodError: error.errors }, 'Data validation failed', { key });
        throw new ValidationError('Memory storage data validation failed', {
          key,
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  async set<T>(key: string, data: T): Promise<void> {
    this.storage.set(key, data);
    this.contextLogger.debug('Data stored successfully', { key });
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async delete(key: string): Promise<void> {
    const existed = this.storage.delete(key);
    this.contextLogger.debug('Delete operation completed', { key, existed });
  }

  async clear(): Promise<void> {
    const size = this.storage.size;
    this.storage.clear();
    this.contextLogger.info('Memory storage cleared', { previousSize: size });
  }
}

/**
 * Redis storage implementation (placeholder for future implementation)
 */
export class RedisStorage implements IStorage {
  private readonly contextLogger = logger.child({ storage: 'redis' });

  constructor(connectionUrl: string, keyPrefix: string = '') {
    this.contextLogger.info('Redis storage initialized', { keyPrefix, connectionUrl });
  }

  async get<T>(_key: string, _schema: z.ZodSchema<T>): Promise<T | null> {
    // TODO: Implement Redis storage
    throw new StorageError('Redis storage not implemented yet');
  }

  async set<T>(_key: string, _data: T): Promise<void> {
    // TODO: Implement Redis storage
    throw new StorageError('Redis storage not implemented yet');
  }

  async exists(_key: string): Promise<boolean> {
    // TODO: Implement Redis storage
    throw new StorageError('Redis storage not implemented yet');
  }

  async delete(_key: string): Promise<void> {
    // TODO: Implement Redis storage
    throw new StorageError('Redis storage not implemented yet');
  }

  async clear(): Promise<void> {
    // TODO: Implement Redis storage
    throw new StorageError('Redis storage not implemented yet');
  }
}

/**
 * Storage factory function
 */
export function createStorage(): IStorage {
  // For now, we don't have a test environment, so this condition is commented out
  // if (config.NODE_ENV === 'test') {
  //   logger.info('Using memory storage for testing');
  //   return new MemoryStorage();
  // }

  if (config.REDIS_URL && config.NODE_ENV === 'production') {
    logger.info('Using Redis storage for production');
    return new RedisStorage(config.REDIS_URL, config.REDIS_KEY_PREFIX);
  }

  logger.info('Using file storage', { basePath: dirname(config.LAST_STATUS_FILE_PATH) });
  return new FileStorage();
}