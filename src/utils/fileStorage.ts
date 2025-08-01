/**
 * File Storage utility
 * JSON file-based persistence with error handling
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from './logger';
import { AppError } from '../types';

/**
 * File Storage class for JSON data persistence
 */
export class FileStorage {
  /**
   * Ensure directory exists (from file path)
   */
  private static async ensureDirectory(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      Logger.debug(`Created directory: ${dir}`);
    }
  }

  /**
   * Ensure directory exists (direct path)
   */
  public static async ensureDirectoryPath(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      Logger.debug(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Read JSON data from file
   */
  public static async readJson<T = unknown>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data) as T;
      Logger.debug(`Successfully read JSON from: ${filePath}`);
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        Logger.debug(`File not found: ${filePath}`);
        return null;
      }

      const message = `Failed to read JSON from ${filePath}`;
      Logger.error(message, error);
      throw new AppError(message, 'FILE_READ_ERROR');
    }
  }

  /**
   * Write JSON data to file
   */
  public static async writeJson(filePath: string, data: unknown): Promise<void> {
    try {
      await this.ensureDirectory(filePath);

      const jsonString = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, jsonString, 'utf-8');

      Logger.debug(`Successfully wrote JSON to: ${filePath}`);
    } catch (error) {
      const message = `Failed to write JSON to ${filePath}`;
      Logger.error(message, error);
      throw new AppError(message, 'FILE_WRITE_ERROR');
    }
  }

  /**
   * Check if file exists
   */
  public static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file if it exists
   */
  public static async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      Logger.debug(`Successfully deleted file: ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        const message = `Failed to delete file ${filePath}`;
        Logger.error(message, error);
        throw new AppError(message, 'FILE_DELETE_ERROR');
      }
    }
  }

  /**
   * Write binary data to file (for images)
   */
  public static async writeBinary(filePath: string, data: Buffer): Promise<void> {
    try {
      await this.ensureDirectory(filePath);
      await fs.writeFile(filePath, data);
      Logger.debug(`Successfully wrote binary data to: ${filePath}`);
    } catch (error) {
      const message = `Failed to write binary data to ${filePath}`;
      Logger.error(message, error);
      throw new AppError(message, 'FILE_WRITE_ERROR');
    }
  }
}
