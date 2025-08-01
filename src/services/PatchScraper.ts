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
      '.sc-4d29e6fd-0 .action',
      '.sc-9565c853-0.action',
      '.sc-4d29e6fd-0 > a',
      '[data-testid="patch-note-card"]',
      'article'
    ],
    title: [
      '.sc-6fae0810-0',
      'span div',
      '.sc-d4b4173b-0',
      '[data-testid="patch-note-title"]',
      'h1',
      'h2',
      'h3'
    ],
    url: [
      '', // Use the element itself if it's an <a> tag
      'a[href*="patch"]',
      'a[href*="news"]',
      '[data-testid="patch-note-link"]',
      'a'
    ],
    image: [
      '.sc-d237f54f-0 img',
      'img[src*="patch"]',
      '[data-testid="patch-note-image"]',
      'img'
    ]
  };

  /**
   * Scrape detailed patch content from individual patch page
   */
  public async scrapeDetailedPatch(patchUrl: string): Promise<{ content?: string; imageUrl?: string }> {
    try {
      Logger.info(`個別ページから詳細情報を取得中: ${patchUrl}`);
      
      const response = await httpClient.get<string>(patchUrl);
      const $ = cheerio.load(response.data);
      
      // パッチノートの本文を抽出
      const content = this.extractPatchContent($);
      
      // 高解像度の画像URLを取得
      const detailImageUrl = this.extractDetailedImageUrl($);
      
      Logger.info(`詳細情報取得完了: コンテンツ=${content ? `${content.length}文字` : 'なし'}, 画像=${detailImageUrl || 'なし'}`);
      
      return { 
        ...(content && { content }),
        ...(detailImageUrl && { imageUrl: detailImageUrl })
      };
      
    } catch (error) {
      Logger.error(`個別ページの詳細情報取得に失敗: ${patchUrl}`, error);
      return {};
    }
  }

  /**
   * Extract patch content from detail page
   */
  private extractPatchContent($: cheerio.CheerioAPI): string | null {
    // パッチノートの本文を取得するためのセレクター
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.article-content',
      '.patch-content',
      '[data-testid="patch-content"]',
      '.content-wrapper',
      '.article-body',
      '.content'
    ];

    for (const selector of contentSelectors) {
      const contentElement = $(selector);
      if (contentElement.length > 0) {
        // HTMLタグを除去してテキストのみ取得
        let content = contentElement.text().trim();
        
        // 不要な改行や空白を整理
        content = content.replace(/\s+/g, ' ').replace(/\n+/g, '\n');
        
        if (content && content.length > 100) { // 十分な長さのコンテンツのみ採用
          Logger.debug(`パッチ本文を取得 (セレクター: ${selector}): ${content.length}文字`);
          return content;
        }
      }
    }

    Logger.debug('パッチ本文が見つかりませんでした');
    return null;
  }

  /**
   * Extract high-resolution image from detail page
   */
  private extractDetailedImageUrl($: cheerio.CheerioAPI): string | null {
    // 1920x1080の高解像度画像を優先的に探す
    const allImages = $('img');
    
    Logger.debug(`詳細ページで${allImages.length}個の画像を発見`);
    
    // 最初に1920x1080の画像を探す
    for (let i = 0; i < allImages.length; i++) {
      const img = allImages.eq(i);
      const src = img.attr('src') || img.attr('data-src');
      
      if (src && this.isValidImageUrl(src)) {
        // 1920x1080の画像を優先
        if (src.includes('1920x1080')) {
          Logger.debug(`1920x1080画像を発見: ${src}`);
          return src;
        }
      }
    }
    
    // 次に高解像度画像を探す（1600x945など）
    for (let i = 0; i < allImages.length; i++) {
      const img = allImages.eq(i);
      const src = img.attr('src') || img.attr('data-src');
      
      if (src && this.isValidImageUrl(src)) {
        // Sanity CDNの高解像度画像
        if (src.includes('cmsassets.rgpub.io') && (src.includes('1600x') || src.includes('1920x'))) {
          Logger.debug(`高解像度画像を発見: ${src}`);
          return src;
        }
      }
    }
    
    // フォールバック: 従来のセレクター
    const detailImageSelectors = [
      '.hero-image img',
      '.patch-hero img',
      '.banner-image img',
      '[data-testid="patch-hero-image"]',
      'article img[src*="patch"]',
      'main img[src*="splash"]',
      '.content img[src*="banner"]'
    ];

    for (const selector of detailImageSelectors) {
      const imgElement = $(selector).first();
      if (imgElement.length > 0) {
        const src = imgElement.attr('src') || imgElement.attr('data-src');
        if (src && this.isValidImageUrl(src)) {
          Logger.debug(`詳細ページから画像URL取得 (セレクター: ${selector}): ${src}`);
          return src;
        }
      }
    }

    Logger.debug('詳細ページから画像URLが見つかりませんでした');
    return null;
  }

  /**
   * Scrape the latest patch notes from the official website
   */  public async scrapeLatestPatch(): Promise<PatchNote | null> {
    try {
      Logger.info('Starting patch notes scraping from: ' + config.lol.patchNotesUrl);
      
      const response = await httpClient.get<string>(config.lol.patchNotesUrl);
      const $ = cheerio.load(response.data);
      
      // Debug: Log available elements
      Logger.debug(`Total elements found: ${$('*').length}`);
      Logger.debug(`Available classes: ${[...$('[class]').map((_, el) => $(el).attr('class')).get()].slice(0, 20).join(', ')}`);
      
      // Debug: Look for grid containers that might contain articles
      const gridContainers = $('.sc-4d29e6fd-0');
      Logger.debug(`Grid containers found: ${gridContainers.length}`);
      gridContainers.each((i, el) => {
        const $el = $(el);
        Logger.debug(`Grid ${i}: classes="${$el.attr('class')}", children=${$el.children().length}`);
        $el.children().each((j, child) => {
          const $child = $(child);
          Logger.debug(`  Child ${j}: tag=${child.tagName}, classes="${$child.attr('class')}"`);
        });
      });
      
      // Try to find the latest patch note using fallback selectors
      const patchElement = this.findElement($, this.selectors.container);
      if (!patchElement) {
        Logger.debug('Container selectors tried:', this.selectors.container);
        throw new ScrapingError('Could not find patch note container');
      }
      
      Logger.debug(`Found patch element with selector: ${patchElement.get(0)?.tagName}`);
      Logger.debug(`Patch element classes: ${patchElement.attr('class')}`);
      Logger.debug(`Patch element children: ${patchElement.children().length}`);
      Logger.debug(`Patch element href: ${patchElement.attr('href')}`);
      Logger.debug(`Patch element text: ${patchElement.text().substring(0, 200)}...`);
      
      // Debug: Show children structure
      patchElement.children().each((i, child) => {
        const $child = $(child);
        Logger.debug(`  Child ${i}: tag=${child.tagName}, classes="${$child.attr('class')}", text="${$child.text().substring(0, 100)}..."`);
        $child.children().each((j, grandchild) => {
          const $grandchild = $(grandchild);
          Logger.debug(`    Grandchild ${j}: tag=${grandchild.tagName}, classes="${$grandchild.attr('class')}", text="${$grandchild.text().substring(0, 50)}..."`);
        });
      });

      const title = this.extractTitle($, patchElement);
      if (!title) {
        throw new ScrapingError('Could not extract patch note title');
      }

      const url = this.extractUrl($, patchElement);
      if (!url) {
        throw new ScrapingError('Could not extract patch note URL');
      }

      const imageUrl = this.extractImageUrl($, patchElement);
      Logger.debug(`Image URL extracted: ${imageUrl || 'None found'}`);
      const version = this.extractVersion(title);

      const normalizedUrl = this.normalizeUrl(url);

      // 個別ページから詳細情報を取得
      Logger.info(`個別ページから詳細情報を取得します: ${normalizedUrl}`);
      const detailedInfo = await this.scrapeDetailedPatch(normalizedUrl);

      const patchNote: PatchNote = {
        version,
        title,
        url: normalizedUrl,
        publishedAt: new Date(),
        ...(detailedInfo.content && { content: detailedInfo.content }),
        ...(detailedInfo.imageUrl && { imageUrl: this.normalizeUrl(detailedInfo.imageUrl) }),
        // 個別ページで画像が見つからない場合は、リストページから取得した画像を使用
        ...(!detailedInfo.imageUrl && imageUrl && { imageUrl: this.normalizeUrl(imageUrl) }),
      };

      Logger.info(`Successfully scraped patch note: ${title}${detailedInfo.content ? ` (本文: ${detailedInfo.content.length}文字)` : ''}${patchNote.imageUrl ? ' (画像あり)' : ''}`);
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
        const fullText = titleElement.text().trim();
        if (fullText) {
          // Extract patch note title from the text
          const patchTitle = this.extractPatchTitle(fullText);
          if (patchTitle) {
            return patchTitle;
          }
        }
      }
    }
    
    // Fallback: use container text and extract patch title
    const containerText = container.text().trim();
    if (containerText) {
      const patchTitle = this.extractPatchTitle(containerText);
      if (patchTitle) {
        return patchTitle;
      }
    }
    
    return null;
  }

  /**
   * Extract patch title from full text
   */
  private extractPatchTitle(text: string): string | null {
    // Look for "パッチノート X.X" or "Patch X.X" patterns
    const patchPatterns = [
      /パッチノート\s*(\d+\.\d+)/i,
      /パッチ\s*(\d+\.\d+)/i,
      /patch\s*(\d+\.\d+)/i,
      /パッチノート\s*(\d+)/i
    ];

    for (const pattern of patchPatterns) {
      const match = text.match(pattern);
      if (match) {
        return `パッチノート ${match[1]}`;
      }
    }

    return null;
  }  /**
   * Extract patch note URL
   */
  private extractUrl($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>): string | null {
    // Check if container itself is an <a> tag
    if (container.is('a')) {
      const href = container.attr('href');
      if (href) {
        return href;
      }
    }
    
    // First try within the container
    for (const selector of this.selectors.url) {
      if (!selector) continue; // Skip empty selector
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
      if (!selector) continue; // Skip empty selector
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
  private extractImageUrl($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>): string | null {    
    Logger.debug('Searching for images in container...');
    
    // First try within the container
    for (const selector of this.selectors.image) {
      Logger.debug(`Trying image selector: ${selector}`);
      const imgElement = container.find(selector).first();
      if (imgElement.length > 0) {
        const src = imgElement.attr('src') || imgElement.attr('data-src');
        Logger.debug(`Found image element with src: ${src}`);
        if (src && this.isValidImageUrl(src)) {
          Logger.debug(`Valid image URL found: ${src}`);
          return src;
        } else if (src) {
          Logger.debug(`Invalid or filtered image URL: ${src}`);
        }
      }
    }
    
    // Debug: Show all images in container
    const allImages = container.find('img');
    Logger.debug(`Total images in container: ${allImages.length}`);
    allImages.each((i, img) => {
      const $img = $(img);
      const src = $img.attr('src') || $img.attr('data-src');
      Logger.debug(`  Image ${i}: src="${src}", classes="${$img.attr('class')}"`);
    });
    
    // Fallback to document-wide search
    Logger.debug('Falling back to document-wide image search...');
    for (const selector of this.selectors.image) {
      const imgElement = $(selector).first();
      if (imgElement.length > 0) {
        const src = imgElement.attr('src') || imgElement.attr('data-src');
        if (src && this.isValidImageUrl(src) && (src.includes('patch') || src.includes('news'))) {
          Logger.debug(`Valid fallback image URL found: ${src}`);
          return src;
        }
      }
    }
    
    Logger.debug('No valid image URL found');
    return null;
  }

  /**
   * Check if URL is a valid image URL
   */
  private isValidImageUrl(url: string): boolean {
    // Skip data URLs with invalid content
    if (url.startsWith('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>')) {
      return false;
    }
    
    // Skip very short or empty data URLs
    if (url.startsWith('data:') && url.length < 100) {
      return false;
    }
    
    // Allow valid HTTP/HTTPS URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }
    
    // Allow valid data URLs with substantial content
    if (url.startsWith('data:image/') && url.length > 100) {
      return true;
    }
    
    return false;
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