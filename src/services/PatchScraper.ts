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
import { type PatchInfo, type DetailedPatchInfo, type ScrapingResult } from '../core/types.js';
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
   * Get detailed patch information with content
   */
  async getDetailedPatchInfo(): Promise<DetailedPatchInfo | null> {
    const startTime = Date.now();
    const contextLogger = logger.child({ operation: 'getDetailedPatchInfo' });

    try {
      // First get basic patch info
      const basicInfo = await this.getLatestPatchInfo();
      if (!basicInfo) {
        return null;
      }

      contextLogger.info('Fetching detailed patch content', { 
        title: basicInfo.title,
        url: basicInfo.url 
      });

      // Fetch the patch page content
      const response = await httpClient.get(basicInfo.url);
      const responseTime = Date.now() - startTime;

      contextLogger.info('Patch page content fetched successfully', {
        statusCode: response.status,
        contentLength: response.data?.length || 0,
        responseTime,
      });

      // Extract content and additional details
      const detailedInfo = await this.extractDetailedContent(basicInfo, response.data);

      contextLogger.info('Detailed patch information extracted successfully', {
        title: detailedInfo.title,
        url: detailedInfo.url,
        contentSize: detailedInfo.contentSize,
        version: detailedInfo.version,
        totalTime: Date.now() - startTime,
      });

      return detailedInfo;

    } catch (error) {
      contextLogger.error({ error }, 'Failed to get detailed patch information');

      if (error instanceof ScrapingError || error instanceof ParsingError) {
        throw error;
      }

      throw new ScrapingError('Failed to get detailed patch information', {
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
        if (titleSelector === '') {
          // Use the link element's text directly
          title = element.text().trim();
        } else {
          const titleElement = element.find(titleSelector);
          if (titleElement.length > 0) {
            title = titleElement.text().trim();
          }
        }
        
        if (title) {
          contextLogger.debug('Title found', { titleSelector, title });
          break;
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

  /**
   * Extract detailed content from patch page HTML
   */
  private async extractDetailedContent(
    basicInfo: PatchInfo, 
    html: string
  ): Promise<DetailedPatchInfo> {
    const contextLogger = logger.child({ operation: 'extractDetailedContent' });
    
    try {
      const $ = cheerio.load(html);
      contextLogger.debug('HTML loaded for content extraction');

      // Extract main content (try multiple selectors)
      const contentSelectors = [
        '.patch-notes-content', 
        '.article-content',
        '.content-wrapper',
        'main',
        '.main-content',
        'article',
        'body'
      ];

      let content = '';
      let summary = '';

      for (const selector of contentSelectors) {
        const contentElement = $(selector);
        if (contentElement.length > 0) {
          // Get text content for summary (first 500 chars)
          const textContent = contentElement.text().trim();
          if (textContent && !summary) {
            summary = textContent.substring(0, 500);
            if (textContent.length > 500) {
              summary += '...';
            }
          }

          // Get HTML content
          const htmlContent = contentElement.html();
          if (htmlContent && !content) {
            content = htmlContent.trim();
            contextLogger.debug('Content extracted with selector', { 
              selector, 
              contentLength: content.length 
            });
            break;
          }
        }
      }

      // If no content found, use body as fallback
      if (!content) {
        content = $('body').html() || '';
        summary = $('body').text().trim().substring(0, 500);
        contextLogger.debug('Using body as content fallback');
      }

      // Extract version from title or URL
      const version = this.extractVersion(basicInfo.title, basicInfo.url);

      // Calculate content hash for deduplication
      const contentHash = this.generateContentHash(content);

      const detailedInfo: DetailedPatchInfo = {
        ...basicInfo,
        content: content || undefined,
        summary: summary || undefined,
        version: version || undefined,
        contentSize: content ? Buffer.byteLength(content, 'utf8') : undefined,
        contentHash: contentHash || undefined,
      };

      contextLogger.debug('Detailed content extraction completed', {
        contentSize: detailedInfo.contentSize,
        summaryLength: summary.length,
        version: detailedInfo.version,
        hasContent: !!content,
      });

      return detailedInfo;

    } catch (error) {
      contextLogger.error({ error }, 'Content extraction failed');
      
      // Return basic info if content extraction fails
      return {
        ...basicInfo,
        content: undefined,
        summary: undefined,
        version: this.extractVersion(basicInfo.title, basicInfo.url) || undefined,
        contentSize: undefined,
        contentHash: undefined,
      };
    }
  }

  /**
   * Extract version from title or URL
   */
  private extractVersion(title: string, url: string): string | null {
    // Try to extract version from title first
    const titleVersionMatch = title.match(/パッチ\s*(\d+\.?\d*\.?\d*)/i) || 
                             title.match(/patch\s*(\d+\.?\d*\.?\d*)/i) ||
                             title.match(/(\d+\.?\d*\.?\d*)\s*パッチ/i);
    
    if (titleVersionMatch) {
      return titleVersionMatch[1] || null;
    }

    // Try to extract from URL
    const urlVersionMatch = url.match(/patch[_-](\d+[_-]?\d*[_-]?\d*)/i);
    if (urlVersionMatch) {
      return urlVersionMatch[1]?.replace(/[_-]/g, '.') || null;
    }

    return null;
  }

  /**
   * Generate a simple hash for content deduplication
   */
  private generateContentHash(content: string): string | null {
    if (!content) return null;
    
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
}