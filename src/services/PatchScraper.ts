/**
 * League of Legends patch notes scraper service
 */

import * as cheerio from 'cheerio';
import { z } from 'zod';

import { config } from '../config/index.js';
import { patchInfoSchema } from '../config/schemas.js';
import { 
  HTTP_CONFIG, 
  SCRAPING_CONFIG, 
  VALIDATION_CONFIG,
} from '../core/constants.js';
import { 
  ScrapingError, 
  ParsingError, 
  NetworkError, 
  ValidationError,
} from '../core/errors.js';
import { type PatchInfo, type ScrapingResult } from '../core/types.js';
import { createContextLogger, logScrapingAttempt } from '../utils/logger.js';
import { httpClient } from '../utils/httpClient.js';

const logger = createContextLogger({ component: 'patchScraper' });

/**
 * Patch scraper service with robust error handling and fallback selectors
 */
export class PatchScraper {
  private readonly baseUrl = HTTP_CONFIG.LOL_BASE_URL;
  private readonly targetUrl = config.LOL_PATCH_NOTES_URL;
  private lastScrapedData: PatchInfo | null = null;
  private lastScrapedTime: number | null = null;

  constructor() {
    logger.info('Patch scraper initialized', {
      baseUrl: this.baseUrl,
      targetUrl: this.targetUrl,
    });
  }

  /**
   * Scrape the latest patch information from the LoL website
   */
  async getLatestPatchInfo(): Promise<PatchInfo | null> {
    const startTime = Date.now();
    const contextLogger = logger.child({ operation: 'getLatestPatchInfo' });

    try {
      contextLogger.info('Starting patch scraping', { url: this.targetUrl });

      // Check cache first
      if (this.shouldUseCachedData()) {
        contextLogger.info('Using cached patch data');
        return this.lastScrapedData;
      }

      // Fetch HTML content
      const response = await httpClient.get(this.targetUrl);
      const responseTime = Date.now() - startTime;

      contextLogger.info('HTML content fetched successfully', {
        statusCode: response.status,
        contentLength: response.data?.length || 0,
        responseTime,
      });

      // Parse HTML and extract patch information
      const patchInfo = await this.parseHtmlContent(response.data);

      if (patchInfo) {
        // Validate extracted data
        const validatedPatchInfo = this.validatePatchInfo(patchInfo);
        
        // Update cache
        this.updateCache(validatedPatchInfo);
        
        logScrapingAttempt(true, this.targetUrl, { 
          patchTitle: validatedPatchInfo.title,
          responseTime,
        });

        contextLogger.info('Patch information extracted successfully', {
          title: validatedPatchInfo.title,
          url: validatedPatchInfo.url,
          totalTime: Date.now() - startTime,
        });

        return validatedPatchInfo;
      }

      logScrapingAttempt(false, this.targetUrl, { reason: 'No patch found' });
      contextLogger.warn('No patch information found on the page');
      return null;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logScrapingAttempt(false, this.targetUrl, { 
        error: error instanceof Error ? error.message : String(error),
        totalTime,
      });

      contextLogger.error({ error }, 'Patch scraping failed');

      if (error instanceof ScrapingError || error instanceof ParsingError) {
        throw error;
      }

      throw new ScrapingError('Failed to scrape patch information', {
        url: this.targetUrl,
        originalError: error,
      });
    }
  }

  /**
   * Get scraping result with detailed information
   */
  async getScrapingResult(): Promise<ScrapingResult> {
    const startTime = Date.now();

    try {
      const patchInfo = await this.getLatestPatchInfo();
      const responseTime = Date.now() - startTime;

      return {
        patchInfo,
        success: patchInfo !== null,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        patchInfo: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        statusCode: error instanceof NetworkError ? 
          (error.context as any)?.status : undefined,
        responseTime,
      };
    }
  }

  /**
   * Parse HTML content and extract patch information
   */
  private async parseHtmlContent(html: string): Promise<PatchInfo | null> {
    const contextLogger = logger.child({ operation: 'parseHtmlContent' });
    
    try {
      const $ = cheerio.load(html);
      contextLogger.debug('HTML loaded into Cheerio');

      // Try multiple selectors in order of preference
      const selectors = [
        SCRAPING_CONFIG.SELECTORS.PRIMARY,
        SCRAPING_CONFIG.SELECTORS.FALLBACK,
        SCRAPING_CONFIG.SELECTORS.LAST_RESORT,
      ];

      for (const [index, selector] of selectors.entries()) {
        contextLogger.debug('Trying selector', { selector, attempt: index + 1 });
        
        const articles = $(selector);
        if (articles.length === 0) {
          contextLogger.debug('No elements found with selector', { selector });
          continue;
        }

        contextLogger.debug('Found articles', { count: articles.length, selector });

        // Process each article to find a valid patch
        for (let i = 0; i < articles.length; i++) {
          const article = articles.eq(i);
          const patchInfo = this.extractPatchInfoFromElement($, article);
          
          if (patchInfo && this.isValidPatchInfo(patchInfo)) {
            contextLogger.info('Valid patch found', { 
              selector, 
              articleIndex: i,
              title: patchInfo.title,
            });
            return patchInfo;
          }
        }
      }

      contextLogger.warn('No valid patch found with any selector');
      return null;

    } catch (error) {
      contextLogger.error({ error }, 'HTML parsing failed');
      throw new ParsingError('Failed to parse HTML content', {
        originalError: error,
      });
    }
  }

  /**
   * Extract patch information from a Cheerio element
   */
  private extractPatchInfoFromElement(
    _$: cheerio.CheerioAPI, 
    element: cheerio.Cheerio<any>
  ): PatchInfo | null {
    const contextLogger = logger.child({ operation: 'extractPatchInfo' });

    try {
      // Extract URL
      const href = element.attr('href');
      if (!href) {
        contextLogger.debug('No href attribute found');
        return null;
      }

      const url = this.resolveUrl(href);
      if (!url) {
        contextLogger.debug('Could not resolve URL', { href });
        return null;
      }

      // Extract title using multiple selectors
      let title: string | null = null;
      for (const titleSelector of SCRAPING_CONFIG.TITLE_SELECTORS) {
        const titleElement = element.find(titleSelector);
        if (titleElement.length > 0) {
          title = titleElement.text().trim();
          if (title) {
            contextLogger.debug('Title found', { titleSelector, title });
            break;
          }
        }
      }

      if (!title) {
        // Fallback to element text or href-based title
        title = element.text().trim() || this.extractTitleFromUrl(url);
        contextLogger.debug('Using fallback title', { title });
      }

      if (!title) {
        contextLogger.debug('Could not extract title');
        return null;
      }

      const patchInfo: PatchInfo = {
        title: this.cleanTitle(title),
        url,
        discoveredAt: new Date().toISOString(),
      } as PatchInfo;

      contextLogger.debug('Patch info extracted', patchInfo);
      return patchInfo;

    } catch (error) {
      contextLogger.warn({ error }, 'Failed to extract patch info from element');
      return null;
    }
  }

  /**
   * Resolve relative URL to absolute URL
   */
  private resolveUrl(href: string): string | null {
    try {
      if (href.startsWith('http')) {
        return href;
      }

      if (href.startsWith('/')) {
        return `${this.baseUrl}${href}`;
      }

      // Relative URL
      return new URL(href, this.targetUrl).toString();
    } catch {
      return null;
    }
  }

  /**
   * Extract title from URL as fallback
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const segments = pathname.split('/');
      const lastSegment = segments[segments.length - 1] || segments[segments.length - 2];
      
      if (lastSegment) {
        // Convert kebab-case to title case (e.g., "patch-14-13-notes" -> "Patch 14 13 Notes")
        return lastSegment
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
    } catch {
      // Ignore errors
    }
    
    return 'League of Legends Patch Notes';
  }

  /**
   * Clean and normalize title text
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^[\s\n\r]+|[\s\n\r]+$/g, '') // Trim
      .substring(0, VALIDATION_CONFIG.MAX_LENGTHS.TITLE); // Limit length
  }

  /**
   * Validate patch information structure and content
   */
  private isValidPatchInfo(patchInfo: PatchInfo): boolean {
    const contextLogger = logger.child({ operation: 'isValidPatchInfo' });

    try {
      // Basic structure validation
      if (!patchInfo.title || !patchInfo.url) {
        contextLogger.debug('Missing required fields');
        return false;
      }

      // URL format validation
      if (!VALIDATION_CONFIG.URL_REGEX.test(patchInfo.url)) {
        contextLogger.debug('Invalid URL format', { url: patchInfo.url });
        return false;
      }

      // Check if URL matches patch note patterns
      const isValidPatchUrl = SCRAPING_CONFIG.URL_PATTERNS.some(pattern => 
        pattern.test(patchInfo.url)
      );

      if (!isValidPatchUrl) {
        contextLogger.debug('URL does not match patch patterns', { url: patchInfo.url });
        return false;
      }

      // Title validation
      if (patchInfo.title.length < 5 || patchInfo.title.length > VALIDATION_CONFIG.MAX_LENGTHS.TITLE) {
        contextLogger.debug('Invalid title length', { 
          title: patchInfo.title,
          length: patchInfo.title.length,
        });
        return false;
      }

      return true;
    } catch (error) {
      contextLogger.warn({ error }, 'Validation check failed');
      return false;
    }
  }

  /**
   * Validate patch info using Zod schema
   */
  private validatePatchInfo(patchInfo: PatchInfo): PatchInfo {
    try {
      return patchInfoSchema.parse(patchInfo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Patch info validation failed', {
          errors: error.errors,
          patchInfo,
        });
      }
      throw error;
    }
  }

  /**
   * Check if cached data should be used
   */
  private shouldUseCachedData(): boolean {
    if (!this.lastScrapedData || !this.lastScrapedTime) {
      return false;
    }

    const cacheAge = Date.now() - this.lastScrapedTime;
    return cacheAge < SCRAPING_CONFIG.CACHE_MAX_AGE_MS;
  }

  /**
   * Update the internal cache
   */
  private updateCache(patchInfo: PatchInfo): void {
    this.lastScrapedData = patchInfo;
    this.lastScrapedTime = Date.now();
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.lastScrapedData = null;
    this.lastScrapedTime = null;
    logger.debug('Scraper cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    hasCachedData: boolean;
    cacheAge?: number;
    cachedPatch?: PatchInfo;
  } {
    if (!this.lastScrapedData || !this.lastScrapedTime) {
      return { hasCachedData: false };
    }

    return {
      hasCachedData: true,
      cacheAge: Date.now() - this.lastScrapedTime,
      cachedPatch: this.lastScrapedData,
    };
  }
}