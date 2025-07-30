/**
 * Simple patch cache service for storing all retrieved patch notes
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { patchCacheSchema, cachedPatchInfoSchema } from '../config/schemas.js';
import { STORAGE_CONFIG, CACHE_CONFIG } from '../core/constants.js';
import { StorageError } from '../core/errors.js';
import { 
  type PatchInfo, 
  type DetailedPatchInfo,
  type PatchCache, 
  type CachedPatchInfo,
} from '../core/types.js';
import { createContextLogger, logError } from '../utils/logger.js';
import { createStorage, type IStorage } from '../utils/storage.js';

const logger = createContextLogger({ component: 'patchCache' });

/**
 * Simple patch cache service that stores all retrieved patch notes
 */
export class PatchCacheService {
  private readonly storage: IStorage;
  private cache: PatchCache | null = null;

  constructor() {
    this.storage = createStorage();
    logger.info('Patch cache service initialized');
  }

  /**
   * Initialize the cache by loading from storage
   */
  async initialize(): Promise<void> {
    const contextLogger = logger.child({ operation: 'initialize' });

    try {
      contextLogger.info('Loading patch cache from storage');
      
      this.cache = await this.storage.get(
        STORAGE_CONFIG.PATCH_CACHE_KEY,
        patchCacheSchema
      );

      if (this.cache) {
        contextLogger.info('Patch cache loaded successfully', {
          totalPatches: this.cache.totalPatches,
          lastUpdated: this.cache.lastUpdated,
          totalSizeBytes: this.cache.metadata.totalSizeBytes,
        });
      } else {
        contextLogger.info('No existing cache found, initializing new cache');
        await this.initializeEmptyCache();
      }

    } catch (error) {
      logError(error, 'Failed to initialize patch cache');
      throw new StorageError('Patch cache initialization failed', { error });
    }
  }

  /**
   * Add or update a patch in the cache (supports both basic and detailed patch info)
   */
  async addPatch(patchInfo: PatchInfo | DetailedPatchInfo): Promise<void> {
    const contextLogger = logger.child({ 
      operation: 'addPatch', 
      patchUrl: patchInfo.url 
    });

    try {
      if (!this.cache) {
        await this.initializeEmptyCache();
      }

      const now = new Date().toISOString();
      const existingPatch = this.cache!.patches[patchInfo.url];

      if (existingPatch) {
        contextLogger.debug('Patch already exists in cache, skipping', {
          title: patchInfo.title,
          cachedAt: existingPatch.cachedAt,
        });
        return;
      }

      // Generate filename for individual patch file
      const fileName = this.generateFileName(patchInfo);
      const filePath = join(STORAGE_CONFIG.PATCHES_DIR, fileName);

      // Ensure patches directory exists
      await this.ensureDirectoryExists(STORAGE_CONFIG.PATCHES_DIR);

      // Create cached patch info
      const cachedPatch: CachedPatchInfo = {
        ...patchInfo,
        cachedAt: now,
        discoveredAt: patchInfo.discoveredAt || now,
        filePath: filePath,
      };

      // Save individual patch file
      await this.saveIndividualPatchFile(filePath, cachedPatch);

      // Add to cache index (without the large content to keep index small)
      const indexEntry: CachedPatchInfo = {
        ...cachedPatch,
        content: undefined, // Don't store content in index
      };

      this.cache!.patches[patchInfo.url] = indexEntry;
      this.cache!.totalPatches = Object.keys(this.cache!.patches).length;
      this.cache!.lastUpdated = now;
      
      // Update metadata
      this.updateCacheMetadata();

      // Save cache index to storage
      await this.storage.set(STORAGE_CONFIG.PATCH_CACHE_KEY, this.cache);

      contextLogger.info('Patch added to cache successfully', {
        title: patchInfo.title,
        url: patchInfo.url,
        filePath: filePath,
        totalPatches: this.cache!.totalPatches,
        hasContent: !!(patchInfo as DetailedPatchInfo).content,
      });

    } catch (error) {
      logError(error, 'Failed to add patch to cache', { patchInfo });
      throw new StorageError('Failed to add patch to cache', { 
        patchInfo, 
        error 
      });
    }
  }

  /**
   * Get a specific patch from cache (loads from individual file if needed)
   */
  async getPatch(url: string, includeContent: boolean = false): Promise<CachedPatchInfo | null> {
    if (!this.cache) {
      return null;
    }

    const indexEntry = this.cache.patches[url];
    if (!indexEntry) {
      return null;
    }

    // If content is not needed or not available, return index entry
    if (!includeContent || !indexEntry.filePath) {
      return indexEntry;
    }

    // Load full patch data from individual file
    try {
      const fullPatch = await this.loadIndividualPatchFile(indexEntry.filePath);
      return fullPatch;
    } catch (error) {
      logError(error, 'Failed to load individual patch file', { 
        url, 
        filePath: indexEntry.filePath 
      });
      // Return index entry as fallback
      return indexEntry;
    }
  }

  /**
   * Get a specific patch from cache (synchronous, index only)
   */
  getPatchSync(url: string): CachedPatchInfo | null {
    if (!this.cache) {
      return null;
    }

    return this.cache.patches[url] || null;
  }

  /**
   * Get all cached patches
   */
  getAllPatches(): CachedPatchInfo[] {
    if (!this.cache) {
      return [];
    }

    return Object.values(this.cache.patches);
  }

  /**
   * Get cached patches sorted by discovery date (newest first)
   */
  getPatchesSorted(): CachedPatchInfo[] {
    const patches = this.getAllPatches();
    return patches.sort((a, b) => {
      const dateA = new Date(a.discoveredAt || a.cachedAt);
      const dateB = new Date(b.discoveredAt || b.cachedAt);
      return dateB.getTime() - dateA.getTime();
    });
  }

  /**
   * Check if a patch exists in cache
   */
  hasPatch(url: string): boolean {
    return this.getPatch(url) !== null;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalPatches: number;
    lastUpdated: string | null;
    totalSizeBytes: number;
    oldestPatch?: { title: string; cachedAt: string } | undefined;
    newestPatch?: { title: string; cachedAt: string } | undefined;
  } {
    if (!this.cache) {
      return {
        totalPatches: 0,
        lastUpdated: null,
        totalSizeBytes: 0,
        oldestPatch: undefined,
        newestPatch: undefined,
      };
    }

    const patches = this.getAllPatches();
    const sortedByCache = patches.sort((a, b) => 
      new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
    );

    const oldest = sortedByCache[0];
    const newest = sortedByCache[sortedByCache.length - 1];

    return {
      totalPatches: this.cache.totalPatches,
      lastUpdated: this.cache.lastUpdated,
      totalSizeBytes: this.cache.metadata.totalSizeBytes,
      oldestPatch: oldest ? { 
        title: oldest.title, 
        cachedAt: oldest.cachedAt 
      } : undefined,
      newestPatch: newest ? { 
        title: newest.title, 
        cachedAt: newest.cachedAt 
      } : undefined,
    };
  }

  /**
   * Get the latest cached patch
   */
  getLatestPatch(): CachedPatchInfo | null {
    const sorted = this.getPatchesSorted();
    return sorted[0] || null;
  }

  /**
   * Initialize an empty cache
   */
  private async initializeEmptyCache(): Promise<void> {
    const now = new Date().toISOString();

    this.cache = {
      patches: {},
      lastUpdated: now,
      totalPatches: 0,
      metadata: {
        maxSize: CACHE_CONFIG.DEFAULT_MAX_SIZE,
        ttlMs: CACHE_CONFIG.DEFAULT_TTL_MS,
        totalSizeBytes: 0,
      },
    };

    // Save initial empty cache
    await this.storage.set(STORAGE_CONFIG.PATCH_CACHE_KEY, this.cache);

    logger.info('Empty patch cache initialized', {
      maxSize: this.cache.metadata.maxSize,
      ttlMs: this.cache.metadata.ttlMs,
    });
  }

  /**
   * Generate filename for patch based on URL and title
   */
  private generateFileName(patchInfo: PatchInfo): string {
    // Create a safe filename from URL
    const urlHash = crypto.createHash('md5').update(patchInfo.url).digest('hex');
    
    // Extract version or create a safe title
    const detailedInfo = patchInfo as DetailedPatchInfo;
    const version = detailedInfo.version || this.extractVersionFromTitle(patchInfo.title);
    
    if (version) {
      return `patch_${version.replace(/\./g, '_')}_${urlHash.substring(0, 8)}.json`;
    }
    
    // Fallback to date-based filename
    const date = new Date().toISOString().split('T')[0]?.replace(/-/g, '') || 'unknown';
    return `patch_${date}_${urlHash.substring(0, 8)}.json`;
  }

  /**
   * Extract version from title (simplified version)
   */
  private extractVersionFromTitle(title: string): string | null {
    const versionMatch = title.match(/パッチ\s*(\d+\.?\d*\.?\d*)/i) || 
                        title.match(/patch\s*(\d+\.?\d*\.?\d*)/i) ||
                        title.match(/(\d+\.?\d*\.?\d*)\s*パッチ/i);
    
    return versionMatch ? versionMatch[1] || null : null;
  }

  /**
   * Save individual patch file
   */
  private async saveIndividualPatchFile(filePath: string, patchInfo: CachedPatchInfo): Promise<void> {
    try {
      const jsonData = JSON.stringify(patchInfo, null, STORAGE_CONFIG.JSON_INDENT);
      await fs.writeFile(filePath, jsonData, STORAGE_CONFIG.FILE_ENCODING);
    } catch (error) {
      throw new StorageError('Failed to save individual patch file', { 
        filePath, 
        error 
      });
    }
  }

  /**
   * Load individual patch file
   */
  private async loadIndividualPatchFile(filePath: string): Promise<CachedPatchInfo> {
    try {
      const data = await fs.readFile(filePath, STORAGE_CONFIG.FILE_ENCODING);
      const parsed = JSON.parse(data);
      return cachedPatchInfoSchema.parse(parsed);
    } catch (error) {
      throw new StorageError('Failed to load individual patch file', { 
        filePath, 
        error 
      });
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new StorageError('Directory creation failed', { dirPath, error });
    }
  }

  /**
   * Update cache metadata (size calculations)
   */
  private updateCacheMetadata(): void {
    if (!this.cache) return;

    // Calculate approximate size in bytes (index only, not including individual files)
    const cacheJson = JSON.stringify(this.cache);
    this.cache.metadata.totalSizeBytes = Buffer.byteLength(cacheJson, 'utf8');
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    const contextLogger = logger.child({ operation: 'cleanup' });

    try {
      if (this.cache) {
        // Save final cache state
        await this.storage.set(STORAGE_CONFIG.PATCH_CACHE_KEY, this.cache);
        
        const stats = this.getCacheStats();
        contextLogger.info('Patch cache cleanup completed', {
          totalPatches: stats.totalPatches,
          totalSizeBytes: stats.totalSizeBytes,
        });
      }

      this.cache = null;
    } catch (error) {
      logError(error, 'Patch cache cleanup failed');
    }
  }
}