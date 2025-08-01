/**
 * ImageDownloader service
 * Handles downloading and caching patch note images
 */

import path from 'path';
import crypto from 'crypto';
import { httpClient } from '../utils/httpClient';
import { FileStorage } from '../utils/fileStorage';
import { Logger } from '../utils/logger';
import { config } from '../config';
import { NetworkError, AppError } from '../types';

export class ImageDownloader {
  private readonly imagesDir: string;

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
      }      // Download image
      const response = await httpClient.get<Buffer>(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'image/*,*/*;q=0.8',
        },
      });

      // Validate response
      if (!response.data || response.status !== 200) {
        throw new NetworkError(`Failed to download image: HTTP ${response.status}`, response.status);
      }

      // Convert ArrayBuffer to Buffer if needed
      const imageBuffer = response.data instanceof ArrayBuffer 
        ? Buffer.from(response.data)
        : response.data as Buffer;

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
  }  /**
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
  public async cleanupOldImages(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      Logger.info('Starting cleanup of old cached images...');
      // Implementation would go here to clean files older than maxAge
      // For now, just log the intent
      Logger.debug(`Would clean images older than ${maxAge}ms`);
    } catch (error) {
      Logger.error('Failed to cleanup old images', error);
    }
  }

  /**
   * Get the local path for a cached image
   */
  public getImagePath(imageUrl: string, patchVersion: string): string {
    const filename = this.generateImageFilename(imageUrl, patchVersion);
    return path.join(this.imagesDir, filename);
  }

  /**
   * Check if image is already cached
   */
  public async isImageCached(imageUrl: string, patchVersion: string): Promise<boolean> {
    const localPath = this.getImagePath(imageUrl, patchVersion);
    return await FileStorage.exists(localPath);
  }
}