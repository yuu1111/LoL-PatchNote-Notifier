/**
 * ImageDownloader service
 * Handles downloading and caching patch note images
 */

import path from 'path';
// import crypto from 'crypto'; // 現在未使用
import { httpClient } from '../utils/httpClient';
import { FileStorage } from '../utils/fileStorage';
import { Logger } from '../utils/logger';
import { config } from '../config/config';
import { AppError, NetworkError } from '../types/types';

export class ImageDownloader {
  private readonly imagesDir: string;

  // Time constants
  private static readonly DAYS_IN_MONTH = 30;
  private static readonly HOURS_IN_DAY = 24;
  private static readonly MINUTES_IN_HOUR = 60;
  private static readonly SECONDS_IN_MINUTE = 60;
  private static readonly MS_IN_SECOND = 1000;

  constructor() {
    this.imagesDir = config.storage.imagesDir;
  }

  /**
   * Download and cache patch image
   */
  public async downloadPatchImage(imageUrl: string, patchVersion: string): Promise<string> {
    try {
      Logger.info(`Downloading patch image for version ${patchVersion}: ${imageUrl}`);

      // Create patch-specific directory
      const sanitizedVersion = patchVersion.replace(/[^a-zA-Z0-9.-]/g, '_');
      const patchDir = path.join(config.storage.patchesDir, `patch_${sanitizedVersion}`);

      // Generate filename based on URL and version
      const filename = this.generateImageFilename(imageUrl, patchVersion);
      const localPath = path.join(patchDir, filename);

      // Ensure patch directory exists
      await FileStorage.ensureDirectoryPath(patchDir);

      // Check if image already exists
      if (await FileStorage.exists(localPath)) {
        Logger.debug(`Image already cached: ${localPath}`);
        return localPath;
      } // Download image
      const response = await httpClient.get<Buffer>(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          Accept: 'image/*,*/*;q=0.8',
        },
      });

      // Response data is always returned due to httpClient design

      // Convert ArrayBuffer to Buffer if needed
      const imageBuffer =
        response.data instanceof ArrayBuffer ? Buffer.from(response.data) : response.data;

      // Validate image data
      if (imageBuffer.length === 0) {
        throw new AppError('Downloaded image is empty', 'EMPTY_IMAGE');
      }

      // Save image to disk
      await FileStorage.writeBinary(localPath, imageBuffer);

      Logger.info(`Successfully downloaded and cached image: ${localPath}`);
      return localPath;
    } catch (error) {
      const message = `Failed to download patch image from ${imageUrl}`;
      Logger.error(message, error);

      if (error instanceof AppError || error instanceof NetworkError) {
        throw error;
      }

      throw new AppError(message, 'IMAGE_DOWNLOAD_ERROR');
    }
  } /**
   * Generate a unique filename for the image
   */
  private generateImageFilename(imageUrl: string, patchVersion: string): string {
    // Extract file extension from URL
    const extension = this.extractFileExtension(imageUrl);

    // Sanitize version for filename
    const sanitizedVersion = patchVersion.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Simple filename: patch_25.15.png
    return `patch_${sanitizedVersion}.${extension}`;
  }

  /**
   * Extract file extension from URL
   */
  private extractFileExtension(url: string): string {
    // Try to get extension from URL path
    const urlPath = new URL(url).pathname;
    const pathExtension = path.extname(urlPath).slice(1).toLowerCase();

    if (pathExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(pathExtension)) {
      return pathExtension;
    }

    // Default to jpg if can't determine
    return 'jpg';
  }

  /**
   * Clean up old cached images (optional utility)
   */
  public cleanupOldImages(
    maxAge: number = ImageDownloader.DAYS_IN_MONTH *
      ImageDownloader.HOURS_IN_DAY *
      ImageDownloader.MINUTES_IN_HOUR *
      ImageDownloader.SECONDS_IN_MINUTE *
      ImageDownloader.MS_IN_SECOND
  ): void {
    try {
      Logger.info('Starting cleanup of old cached images...');
      // Implementation would go here to clean files older than maxAge
      // For now, just log the intent
      Logger.debug(`Would clean images older than ${maxAge}ms`);
    } catch (error: unknown) {
      Logger.error('Failed to cleanup old images', error);
    }
  }

  /**
   * Get the local path for a cached image
   */
  public getImagePath(imageUrl: string, patchVersion: string): string {
    const sanitizedVersion = patchVersion.replace(/[^a-zA-Z0-9.-]/g, '_');
    const patchDir = path.join(config.storage.patchesDir, `patch_${sanitizedVersion}`);
    const filename = this.generateImageFilename(imageUrl, patchVersion);
    return path.join(patchDir, filename);
  }

  /**
   * Check if image is already cached
   */
  public isImageCached(imageUrl: string, patchVersion: string): Promise<boolean> {
    const localPath = this.getImagePath(imageUrl, patchVersion);
    return FileStorage.exists(localPath);
  }
}
