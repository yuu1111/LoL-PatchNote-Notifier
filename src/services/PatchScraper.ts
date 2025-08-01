/**
 * PatchScraper service
 * Handles scraping patch notes from the official LoL website
 */

import * as cheerio from 'cheerio';
import { httpClient } from '../utils/httpClient';
import { Logger } from '../utils/logger';
import { config } from '../config';
import { PatchNote, ScrapingError } from '../types';

/**
 * Fallback selectors for robust HTML parsing
 */
interface SelectorSet {
  container: string[];
  title: string[];
  url: string[];
  image: string[];
}

export class PatchScraper {
  private readonly selectors: SelectorSet = {
    container: [
      '[data-testid="patch-note-card"]',
      '.style__Wrapper-sc-*',
      '.patch-note-item',
      'article',
      '.news-item'
    ],
    title: [
      '[data-testid="patch-note-title"]',
      '.style__Title-sc-*',
      'h1',
      'h2',
      'h3',
      '.title'
    ],
    url: [
      '[data-testid="patch-note-link"]',
      '.style__Link-sc-*',
      'a[href*="patch"]',
      'a'
    ],
    image: [
      '[data-testid="patch-note-image"]',
      '.style__Image-sc-*',
      'img[src*="patch"]',
      'img'
    ]
  };

  /**
   * Scrape the latest patch notes from the official website
   */  public async scrapeLatestPatch(): Promise<PatchNote | null> {
    try {
      Logger.info('Starting patch notes scraping from: ' + config.lol.patchNotesUrl);
      
      const response = await httpClient.get<string>(config.lol.patchNotesUrl);
      const $ = cheerio.load(response.data);
      
      // Try to find the latest patch note using fallback selectors
      const patchElement = this.findElement($, this.selectors.container);
      if (!patchElement) {
        throw new ScrapingError('Could not find patch note container');
      }

      const title = this.extractTitle($, patchElement);
      if (!title) {
        throw new ScrapingError('Could not extract patch note title');
      }

      const url = this.extractUrl($, patchElement);
      if (!url) {
        throw new ScrapingError('Could not extract patch note URL');
      }

      const imageUrl = this.extractImageUrl($, patchElement);
      const version = this.extractVersion(title);

      const patchNote: PatchNote = {
        version,
        title,
        url: this.normalizeUrl(url),
        publishedAt: new Date(),
        ...(imageUrl && { imageUrl: this.normalizeUrl(imageUrl) }),
      };

      Logger.info(`Successfully scraped patch note: ${title}`);
      return patchNote;
      
    } catch (error) {
      const message = 'Failed to scrape patch notes';
      Logger.error(message, error);
      
      if (error instanceof ScrapingError) {
        throw error;
      }
      
      throw new ScrapingError(message);
    }
  }  /**
   * Find element using fallback selectors
   */
  private findElement($: cheerio.CheerioAPI, selectors: string[]): cheerio.Cheerio<any> | null {
    for (const selector of selectors) {
      try {
        const elements = $(selector);
        if (elements.length > 0) {
          Logger.debug(`Found element with selector: ${selector}`);
          return elements.first();
        }
      } catch (error) {
        Logger.debug(`Selector failed: ${selector}`, error);
        continue;
      }
    }
    return null;
  }

  /**
   * Extract patch note title
   */
  private extractTitle($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>): string | null {
    // First try within the container
    for (const selector of this.selectors.title) {
      const titleElement = container.find(selector).first();
      if (titleElement.length > 0) {
        const title = titleElement.text().trim();
        if (title) {
          return title;
        }
      }
    }
    
    // Fallback to document-wide search
    for (const selector of this.selectors.title) {
      const titleElement = $(selector).first();
      if (titleElement.length > 0) {
        const title = titleElement.text().trim();
        if (title && title.toLowerCase().includes('patch')) {
          return title;
        }
      }
    }
    
    return null;
  }  /**
   * Extract patch note URL
   */
  private extractUrl($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>): string | null {
    // First try within the container
    for (const selector of this.selectors.url) {
      const linkElement = container.find(selector).first();
      if (linkElement.length > 0) {
        const href = linkElement.attr('href');
        if (href) {
          return href;
        }
      }
    }
    
    // Fallback to document-wide search
    for (const selector of this.selectors.url) {
      const linkElement = $(selector).first();
      if (linkElement.length > 0) {
        const href = linkElement.attr('href');
        if (href && href.includes('patch')) {
          return href;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract patch note image URL
   */
  private extractImageUrl($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>): string | null {    // First try within the container
    for (const selector of this.selectors.image) {
      const imgElement = container.find(selector).first();
      if (imgElement.length > 0) {
        const src = imgElement.attr('src') || imgElement.attr('data-src');
        if (src) {
          return src;
        }
      }
    }
    
    // Fallback to document-wide search
    for (const selector of this.selectors.image) {
      const imgElement = $(selector).first();
      if (imgElement.length > 0) {
        const src = imgElement.attr('src') || imgElement.attr('data-src');
        if (src && (src.includes('patch') || src.includes('news'))) {
          return src;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract version number from title
   */
  private extractVersion(title: string): string {
    // Match patterns like "パッチ 14.1", "Patch 14.1", "14.1", etc.
    const versionMatch = title.match(/(\d+\.\d+(?:\.\d+)?)/);
    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }
    
    // Fallback: use timestamp-based version
    const now = new Date();
    return `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}`;
  }

  /**
   * Normalize URL (make absolute if relative)
   */
  private normalizeUrl(url: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    
    if (url.startsWith('/')) {
      return 'https://www.leagueoflegends.com' + url;
    }
    
    return url;
  }
}