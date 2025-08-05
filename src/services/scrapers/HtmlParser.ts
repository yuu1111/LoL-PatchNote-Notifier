/**
 * Enhanced HtmlParser service
 * エンタープライズ級HTML解析サービス - DI対応版
 */

import type * as cheerio from 'cheerio';
import type { Logger } from '../../utils/logger';
import type { ImageValidatorInterface } from './ImageValidator';

/**
 * Fallback selectors for robust HTML parsing
 */
export interface SelectorSet {
  container: string[];
  title: string[];
  url: string[];
  image: string[];
}

/**
 * HTML解析結果
 */
export interface ParseResult<T> {
  success: boolean;
  value?: T;
  selectorUsed?: string;
  fallbackUsed?: boolean;
  attemptCount: number;
  parseTime: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 要素検索結果
 */
export interface ElementSearchResult {
  element: cheerio.Cheerio<any> | null;
  selector: string;
  fallbackLevel: number;
  searchTime: number;
  elementCount: number;
}

/**
 * HTML解析設定
 */
export interface HtmlParserConfig {
  enableFallbackSearch: boolean;
  maxSelectorAttempts: number;
  enableCaching: boolean;
  cacheTimeout: number; // ms
  enableMetrics: boolean;
  enableDeepSearch: boolean;
  searchTimeout: number; // ms
  validateResults: boolean;
  strictMode: boolean;
  // 高度な解析機能
  enableXPathSupport: boolean;
  enableParallelParsing: boolean;
  maxParallelTasks: number;
  enableStreamingParsing: boolean;
  streamChunkSize: number; // bytes
  enableAdvancedPatterns: boolean;
  enableDomManipulation: boolean;
  enableContentAnalysis: boolean;
  performanceOptimization: boolean;
}

/**
 * 解析メトリクス
 */
export interface ParseMetrics {
  totalParses: number;
  successfulParses: number;
  failedParses: number;
  averageParseTime: number;
  selectorSuccessRate: Record<string, number>;
  fallbackUsageRate: number;
  cacheHitRate: number;
  operationDistribution: Record<string, number>;
}

/**
 * キャッシュエントリ
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  metadata: Record<string, any>;
}

/**
 * 高度なパターンマッチング
 */
export interface AdvancedPattern {
  name: string;
  selectors: string[];
  xpath?: string;
  regex?: RegExp;
  validator?: (element: cheerio.Cheerio<any>) => boolean;
  transformer?: (element: cheerio.Cheerio<any>) => any;
  priority: number;
}

/**
 * パターンマッチ結果
 */
export interface PatternMatch {
  pattern: string;
  matches: {
    element: cheerio.Cheerio<any>;
    value: any;
    confidence: number;
    position: { x: number; y: number };
  }[];
  totalMatches: number;
  processingTime: number;
}

/**
 * コンテンツ分析オプション
 */
export interface ContentAnalysisOptions {
  includeMetadata: boolean;
  analyzeSemantic: boolean;
  extractKeywords: boolean;
  detectLanguage: boolean;
  analyzeStructure: boolean;
  includeReadability: boolean;
}

/**
 * コンテンツ分析結果
 */
export interface ContentAnalysisResult {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  headingCount: number;
  linkCount: number;
  imageCount: number;
  language?: string;
  keywords: string[];
  readabilityScore?: number;
  semanticStructure: {
    sections: string[];
    topics: string[];
    entities: string[];
  };
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    publishDate?: Date;
  };
}

/**
 * DOM操作
 */
export interface DOMOperation {
  type: 'add' | 'remove' | 'modify' | 'replace';
  selector: string;
  content?: string;
  attributes?: Record<string, string>;
  position?: 'before' | 'after' | 'append' | 'prepend';
}

/**
 * 並列解析タスク
 */
export interface ParsingTask {
  id: string;
  type: 'extract' | 'search' | 'analyze';
  selectors: string[];
  options?: any;
  priority: number;
}

/**
 * XPath解析結果
 */
export interface XPathResult {
  nodes: any[];
  count: number;
  xpath: string;
  processingTime: number;
}

/**
 * ストリーミング解析チャンク
 */
export interface StreamChunk {
  data: string;
  position: number;
  isComplete: boolean;
  metadata: Record<string, any>;
}

/**
 * HtmlParserインターフェース
 */
export interface HtmlParserInterface {
  findElement($: cheerio.CheerioAPI, selectors: string[]): ElementSearchResult;
  extractTitle(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    titleSelectors: string[]
  ): ParseResult<string>;
  extractUrl(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    urlSelectors: string[]
  ): ParseResult<string>;
  extractImageUrl(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    imageSelectors: string[]
  ): ParseResult<string>;
  extractVersion(title: string): string;
  normalizeUrl(url: string): string;
  getMetrics(): ParseMetrics;
  // 高度な解析機能
  parseWithXPath(html: string, xpath: string): ParseResult<any[]>;
  parseWithAdvancedPatterns(
    $: cheerio.CheerioAPI,
    patterns: AdvancedPattern[]
  ): ParseResult<PatternMatch[]>;
  analyzeContent($: cheerio.CheerioAPI, options?: ContentAnalysisOptions): ContentAnalysisResult;
  streamParse(
    htmlStream: ReadableStream,
    selectors: string[]
  ): AsyncGenerator<ParseResult<any>, void, unknown>;
  manipulateDOM($: cheerio.CheerioAPI, operations: DOMOperation[]): ParseResult<cheerio.CheerioAPI>;
  parallelParse($: cheerio.CheerioAPI, tasks: ParsingTask[]): Promise<ParseResult<any>[]>;
}

/**
 * エンタープライズ級HTML解析サービス
 * 依存関係注入対応、設定可能、メトリクス収集、キャッシュ機能付き
 */
export class HtmlParser implements HtmlParserInterface {
  private static readonly SIXTY_CONSTANT = 60;
  private static readonly FOUR_CONSTANT = 4;
  private static readonly FIVE_CONSTANT = 5;
  private static readonly TEN_CONSTANT = 10;
  private static readonly SIXTY_FOUR_CONSTANT = 64;
  private static readonly ONE_HUNDRED_CONSTANT = 100;
  private static readonly ONE_THOUSAND_CONSTANT = 1000;
  private static readonly DEFAULT_CACHE_TIMEOUT =
    HtmlParser.FIVE_CONSTANT * HtmlParser.SIXTY_CONSTANT * HtmlParser.ONE_THOUSAND_CONSTANT; // 5分
  private static readonly DEFAULT_SEARCH_TIMEOUT = HtmlParser.ONE_THOUSAND_CONSTANT; // 1秒
  private static readonly DEFAULT_MAX_SELECTOR_ATTEMPTS = HtmlParser.TEN_CONSTANT;
  private static readonly KILOBYTE_CONSTANT = 1024;
  private static readonly DEFAULT_STREAM_CHUNK_SIZE =
    HtmlParser.SIXTY_FOUR_CONSTANT * HtmlParser.KILOBYTE_CONSTANT; // 64KB
  private static readonly DEFAULT_MAX_PARALLEL_TASKS = HtmlParser.FOUR_CONSTANT;

  private readonly config: HtmlParserConfig;
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly metrics: ParseMetrics;
  private readonly startTime: number;
  private readonly performanceMonitor = {
    parseCount: 0,
    totalParseTime: 0,
    averageParseTime: 0,
    peakMemoryUsage: 0,
  };

  constructor(
    private readonly imageValidator?: ImageValidatorInterface,
    config?: Partial<HtmlParserConfig>,
    private readonly logger?: typeof Logger
  ) {
    this.startTime = Date.now();

    // デフォルト設定
    this.config = {
      enableFallbackSearch: true,
      maxSelectorAttempts: HtmlParser.DEFAULT_MAX_SELECTOR_ATTEMPTS,
      enableCaching: true,
      cacheTimeout: HtmlParser.DEFAULT_CACHE_TIMEOUT,
      enableMetrics: true,
      enableDeepSearch: false,
      searchTimeout: HtmlParser.DEFAULT_SEARCH_TIMEOUT,
      validateResults: true,
      strictMode: false,
      // 高度な解析機能のデフォルト
      enableXPathSupport: false,
      enableParallelParsing: false,
      maxParallelTasks: HtmlParser.DEFAULT_MAX_PARALLEL_TASKS,
      enableStreamingParsing: false,
      streamChunkSize: HtmlParser.DEFAULT_STREAM_CHUNK_SIZE,
      enableAdvancedPatterns: false,
      enableDomManipulation: false,
      enableContentAnalysis: false,
      performanceOptimization: true,
      ...config,
    };

    // メトリクス初期化
    this.metrics = {
      totalParses: 0,
      successfulParses: 0,
      failedParses: 0,
      averageParseTime: 0,
      selectorSuccessRate: {},
      fallbackUsageRate: 0,
      cacheHitRate: 0,
      operationDistribution: {},
    };

    this.logger?.debug('HtmlParser initialized with config:', this.config);
  }

  /**
   * Find element using fallback selectors (Enhanced version)
   * 複数のセレクタを順番に試して、最初に見つかった要素を返す
   */
  public findElement($: cheerio.CheerioAPI, selectors: string[]): ElementSearchResult {
    const startTime = performance.now();
    let totalElements = 0;

    for (let i = 0; i < selectors.length && i < this.config.maxSelectorAttempts; i++) {
      const selector = selectors[i];
      if (!selector) continue;

      try {
        const elements = $(selector);
        totalElements += elements.length;

        if (elements.length > 0) {
          const searchTime = performance.now() - startTime;

          this.logger?.debug(
            `Found element with selector: ${selector} (${elements.length} elements, ${searchTime.toFixed(2)}ms)`
          );

          // メトリクス更新
          if (this.config.enableMetrics) {
            this.updateSelectorMetrics(selector, true);
          }

          return {
            element: elements.first(),
            selector,
            fallbackLevel: i,
            searchTime,
            elementCount: elements.length,
          };
        }
      } catch (error) {
        this.logger?.debug(`Selector failed: ${selector}`, error);

        if (this.config.enableMetrics) {
          this.updateSelectorMetrics(selector, false);
        }

        continue;
      }
    }

    const searchTime = performance.now() - startTime;

    return {
      element: null,
      selector: '',
      fallbackLevel: -1,
      searchTime,
      elementCount: totalElements,
    };
  }

  /**
   * Extract title from container element (Enhanced version)
   * コンテナ要素からタイトルを抽出
   */
  public extractTitle(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    titleSelectors: string[]
  ): ParseResult<string> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('title', container.html() ?? '', titleSelectors);

    // キャッシュチェック
    const cachedResult = this.checkTitleCache(cacheKey, startTime);
    if (cachedResult) return cachedResult;

    try {
      // コンテナ内での検索
      const containerResult = this.searchTitleInContainer(
        container,
        titleSelectors,
        cacheKey,
        startTime
      );
      if (containerResult) return containerResult;

      // フォールバック検索
      const fallbackResult = this.searchTitleWithFallback(container, cacheKey, startTime);
      if (fallbackResult) return fallbackResult;

      // 失敗
      this.updateOperationMetrics('extractTitle', false);
      return this.createFailureResult<string>(
        'No title found',
        titleSelectors.length + (this.config.enableFallbackSearch ? 1 : 0),
        performance.now() - startTime
      );
    } catch (error) {
      this.updateOperationMetrics('extractTitle', false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createFailureResult<string>(errorMessage, 1, performance.now() - startTime);
    }
  }

  /**
   * Extract URL from container element (Enhanced version)
   * コンテナ要素からURLを抽出
   */
  public extractUrl(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    urlSelectors: string[]
  ): ParseResult<string> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('url', container.html() ?? '', urlSelectors);

    // キャッシュチェック
    const cachedResult = this.checkUrlCache(cacheKey, startTime);
    if (cachedResult) return cachedResult;

    try {
      const result = this.performUrlExtraction($, container, urlSelectors, cacheKey, startTime);
      return result;
    } catch (error) {
      this.updateOperationMetrics('extractUrl', false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createFailureResult<string>(errorMessage, 1, performance.now() - startTime);
    }
  }

  /**
   * Extract image URL from container element (Enhanced version)
   * コンテナ要素から画像URLを抽出
   */
  public extractImageUrl(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    imageSelectors: string[]
  ): ParseResult<string> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('image', container.html() ?? '', imageSelectors);

    // キャッシュチェック
    const cachedResult = this.checkImageUrlCache(cacheKey, startTime);
    if (cachedResult) return cachedResult;

    try {
      const result = this.performImageUrlExtraction(
        $,
        container,
        imageSelectors,
        cacheKey,
        startTime
      );
      return result;
    } catch (error) {
      this.updateOperationMetrics('extractImageUrl', false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createFailureResult<string>(errorMessage, 1, performance.now() - startTime);
    }
  }

  /**
   * Extract version number from title (Enhanced version)
   * タイトルからバージョン番号を抽出
   */
  public extractVersion(title: string): string {
    // 複数のバージョンパターンをサポート
    const versionPatterns = [
      /(\d+\.\d+\.\d+)/, // 14.1.1
      /(\d+\.\d+)/, // 14.1
      /v(\d+\.\d+\.\d+)/i, // v14.1.1
      /v(\d+\.\d+)/i, // v14.1
      /バージョン\s*(\d+\.\d+)/, // バージョン 14.1
      /version\s*(\d+\.\d+)/i, // Version 14.1
    ];

    for (const pattern of versionPatterns) {
      const match = title.match(pattern);
      if (match?.[1]) {
        this.logger?.debug(`Version extracted: ${match[1]} from title: ${title}`);
        return match[1];
      }
    }

    // フォールバック: タイムスタンプベースのバージョン
    const now = new Date();
    const fallbackVersion = `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}`;

    this.logger?.warn(`No version found in title: ${title}, using fallback: ${fallbackVersion}`);
    return fallbackVersion;
  }

  /**
   * Normalize URL (Enhanced version)
   * 相対URLを絶対URLに変換
   */
  public normalizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      this.logger?.warn('Invalid URL provided for normalization:', url);
      return '';
    }

    // 既に絶対URLの場合
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // プロトコル相対URL
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    // ルート相対URL
    if (url.startsWith('/')) {
      return `https://www.leagueoflegends.com${url}`;
    }

    // その他の相対URL
    return `https://www.leagueoflegends.com/${url}`;
  }

  /**
   * Get parsing metrics
   */
  public getMetrics(): ParseMetrics {
    return { ...this.metrics };
  }

  // === 後方互換性メソッド ===

  /**
   * Find element using fallback selectors (Legacy wrapper)
   */

  public findElementLegacy(
    $: cheerio.CheerioAPI,
    selectors: string[]
  ): cheerio.Cheerio<any> | null {
    const result = this.findElement($, selectors);
    return result.element;
  }

  // === プライベートメソッド ===

  private checkTitleCache(cacheKey: string, startTime: number): ParseResult<string> | null {
    if (this.config.enableCaching) {
      const cached = this.getFromCache<string>(cacheKey);
      if (cached) {
        return this.createSuccessResult(cached, '', true, 1, performance.now() - startTime);
      }
    }
    return null;
  }

  private searchTitleInContainer(
    container: cheerio.Cheerio<any>,
    titleSelectors: string[],
    cacheKey: string,
    startTime: number
  ): ParseResult<string> | null {
    let attemptCount = 0;

    for (const selector of titleSelectors) {
      attemptCount++;
      const titleElement = container.find(selector).first();

      if (titleElement.length > 0) {
        const fullText = titleElement.text().trim();
        if (fullText) {
          const patchTitle = this.extractPatchTitle(fullText);
          if (patchTitle) {
            const result = this.createSuccessResult(
              patchTitle,
              selector,
              false,
              attemptCount,
              performance.now() - startTime
            );

            // キャッシュに保存
            if (this.config.enableCaching) {
              this.saveToCache(cacheKey, patchTitle, { selector, method: 'container' });
            }

            this.updateOperationMetrics('extractTitle', true);
            return result;
          }
        }
      }
    }
    return null;
  }

  private searchTitleWithFallback(
    container: cheerio.Cheerio<any>,
    cacheKey: string,
    startTime: number
  ): ParseResult<string> | null {
    if (!this.config.enableFallbackSearch) return null;

    const containerText = container.text().trim();
    if (containerText) {
      const patchTitle = this.extractPatchTitle(containerText);
      if (patchTitle) {
        const result = this.createSuccessResult(
          patchTitle,
          'container-text',
          true,
          1,
          performance.now() - startTime
        );

        if (this.config.enableCaching) {
          this.saveToCache(cacheKey, patchTitle, { method: 'fallback' });
        }

        this.updateOperationMetrics('extractTitle', true);
        return result;
      }
    }
    return null;
  }

  /**
   * Extract patch title from full text
   */
  private extractPatchTitle(text: string): string | null {
    const patchPatterns = [
      /パッチノート\s*(\d+\.\d+(?:\.\d+)?)/i,
      /パッチ\s*(\d+\.\d+(?:\.\d+)?)/i,
      /patch\s*notes?\s*(\d+\.\d+(?:\.\d+)?)/i,
      /patch\s*(\d+\.\d+(?:\.\d+)?)/i,
      /アップデート\s*(\d+\.\d+(?:\.\d+)?)/i,
      /update\s*(\d+\.\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of patchPatterns) {
      const match = text.match(pattern);
      if (match) {
        return `パッチノート ${match[1]}`;
      }
    }

    return null;
  }

  /**
   * Check URL cache
   */
  private checkUrlCache(cacheKey: string, startTime: number): ParseResult<string> | null {
    if (this.config.enableCaching) {
      const cached = this.getFromCache<string>(cacheKey);
      if (cached) {
        return this.createSuccessResult(cached, '', true, 1, performance.now() - startTime);
      }
    }
    return null;
  }

  /**
   * Perform URL extraction with fallback strategies
   */
  private performUrlExtraction(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    urlSelectors: string[],
    cacheKey: string,
    startTime: number
  ): ParseResult<string> {
    let attemptCount = 0;

    // コンテナ自体がアンカータグかチェック
    const containerHrefResult = this.tryExtractFromContainerHref(
      container,
      cacheKey,
      startTime,
      attemptCount + 1
    );
    if (containerHrefResult) return containerHrefResult;
    attemptCount++;

    // コンテナ内検索
    const containerSearchResult = this.tryExtractFromContainerSearch(
      container,
      urlSelectors,
      cacheKey,
      startTime,
      attemptCount + urlSelectors.length
    );
    if (containerSearchResult) return containerSearchResult;
    attemptCount += urlSelectors.length;

    // フォールバック: ドキュメント全体から検索
    const documentFallbackResult = this.tryExtractFromDocumentFallback(
      $,
      urlSelectors,
      cacheKey,
      startTime,
      attemptCount + urlSelectors.length
    );
    if (documentFallbackResult) return documentFallbackResult;
    attemptCount += urlSelectors.length;

    // 失敗
    this.updateOperationMetrics('extractUrl', false);
    return this.createFailureResult<string>(
      'No URL found',
      attemptCount,
      performance.now() - startTime
    );
  }

  /**
   * Try to extract URL from container href attribute
   */
  private tryExtractFromContainerHref(
    container: cheerio.Cheerio<any>,
    cacheKey: string,
    startTime: number,
    attemptCount: number
  ): ParseResult<string> | null {
    const containerHref = this.getContainerHref(container);
    if (containerHref) {
      const result = this.createSuccessResult(
        containerHref,
        'container-href',
        false,
        attemptCount,
        performance.now() - startTime
      );

      if (this.config.enableCaching) {
        this.saveToCache(cacheKey, containerHref, { method: 'container-href' });
      }

      this.updateOperationMetrics('extractUrl', true);
      return result;
    }
    return null;
  }

  /**
   * Try to extract URL from container search
   */
  private tryExtractFromContainerSearch(
    container: cheerio.Cheerio<any>,
    urlSelectors: string[],
    cacheKey: string,
    startTime: number,
    attemptCount: number
  ): ParseResult<string> | null {
    const containerUrl = this.extractUrlFromContainer(container, urlSelectors);

    if (containerUrl.success && containerUrl.value) {
      const result = this.createSuccessResult(
        containerUrl.value,
        containerUrl.selectorUsed ?? '',
        false,
        attemptCount,
        performance.now() - startTime
      );

      if (this.config.enableCaching) {
        this.saveToCache(cacheKey, containerUrl.value, {
          method: 'container-search',
          selector: containerUrl.selectorUsed,
        });
      }

      this.updateOperationMetrics('extractUrl', true);
      return result;
    }
    return null;
  }

  /**
   * Try to extract URL from document fallback
   */
  private tryExtractFromDocumentFallback(
    $: cheerio.CheerioAPI,
    urlSelectors: string[],
    cacheKey: string,
    startTime: number,
    attemptCount: number
  ): ParseResult<string> | null {
    if (!this.config.enableFallbackSearch) return null;

    const documentUrl = this.extractUrlFromDocument($, urlSelectors);
    if (documentUrl) {
      const result = this.createSuccessResult(
        documentUrl,
        'document-fallback',
        true,
        attemptCount,
        performance.now() - startTime
      );

      if (this.config.enableCaching) {
        this.saveToCache(cacheKey, documentUrl, { method: 'document-fallback' });
      }

      this.updateOperationMetrics('extractUrl', true);
      return result;
    }
    return null;
  }

  /**
   * Get href from container if it's an anchor tag
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getContainerHref(container: cheerio.Cheerio<any>): string | null {
    if (container.is('a')) {
      const href = container.attr('href');
      if (href) {
        return href;
      }
    }
    return null;
  }

  /**
   * Extract URL from within container
   */

  private extractUrlFromContainer(
    container: cheerio.Cheerio<any>,
    urlSelectors: string[]
  ): ParseResult<string> {
    for (const selector of urlSelectors) {
      if (!selector) continue;

      const linkElement = container.find(selector).first();
      if (linkElement.length > 0) {
        const href = linkElement.attr('href');
        if (href) {
          return {
            success: true,
            value: href,
            selectorUsed: selector,
            fallbackUsed: false,
            attemptCount: 1,
            parseTime: 0,
          };
        }
      }
    }

    return {
      success: false,
      fallbackUsed: false,
      attemptCount: urlSelectors.length,
      parseTime: 0,
    };
  }

  /**
   * Extract URL from document as fallback
   */
  private extractUrlFromDocument($: cheerio.CheerioAPI, urlSelectors: string[]): string | null {
    for (const selector of urlSelectors) {
      if (!selector) continue;

      const linkElement = $(selector).first();
      if (linkElement.length > 0) {
        const href = linkElement.attr('href');
        if (href?.includes('patch')) {
          return href;
        }
      }
    }
    return null;
  }

  /**
   * Check image URL cache
   */
  private checkImageUrlCache(cacheKey: string, startTime: number): ParseResult<string> | null {
    if (this.config.enableCaching) {
      const cached = this.getFromCache<string>(cacheKey);
      if (cached) {
        return this.createSuccessResult(cached, '', true, 1, performance.now() - startTime);
      }
    }
    return null;
  }

  /**
   * Perform image URL extraction with fallback strategies
   */
  private performImageUrlExtraction(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    imageSelectors: string[],
    cacheKey: string,
    startTime: number
  ): ParseResult<string> {
    let attemptCount = 0;

    // コンテナ内検索
    const containerResult = this.tryExtractImageFromContainer(
      container,
      imageSelectors,
      cacheKey,
      startTime,
      attemptCount + imageSelectors.length
    );
    if (containerResult) return containerResult;
    attemptCount += imageSelectors.length;

    // フォールバック: ドキュメント全体から検索
    const documentResult = this.tryExtractImageFromDocument(
      $,
      imageSelectors,
      cacheKey,
      startTime,
      attemptCount + imageSelectors.length
    );
    if (documentResult) return documentResult;
    attemptCount += imageSelectors.length;

    // 失敗
    this.updateOperationMetrics('extractImageUrl', false);
    return this.createFailureResult<string>(
      'No image URL found',
      attemptCount,
      performance.now() - startTime
    );
  }

  /**
   * Try to extract image URL from container
   */
  private tryExtractImageFromContainer(
    container: cheerio.Cheerio<any>,
    imageSelectors: string[],
    cacheKey: string,
    startTime: number,
    attemptCount: number
  ): ParseResult<string> | null {
    const containerImageUrl = this.findImageInContainer(container, imageSelectors);

    if (containerImageUrl.success && containerImageUrl.value) {
      const result = this.createSuccessResult(
        containerImageUrl.value,
        containerImageUrl.selectorUsed ?? '',
        false,
        attemptCount,
        performance.now() - startTime
      );

      if (this.config.enableCaching) {
        this.saveToCache(cacheKey, containerImageUrl.value, {
          method: 'container',
          selector: containerImageUrl.selectorUsed,
        });
      }

      this.updateOperationMetrics('extractImageUrl', true);
      return result;
    }
    return null;
  }

  /**
   * Try to extract image URL from document fallback
   */
  private tryExtractImageFromDocument(
    $: cheerio.CheerioAPI,
    imageSelectors: string[],
    cacheKey: string,
    startTime: number,
    attemptCount: number
  ): ParseResult<string> | null {
    if (!this.config.enableFallbackSearch) return null;

    const documentImageUrl = this.findImageInDocument($, imageSelectors);
    if (documentImageUrl) {
      const result = this.createSuccessResult(
        documentImageUrl,
        'document-fallback',
        true,
        attemptCount,
        performance.now() - startTime
      );

      if (this.config.enableCaching) {
        this.saveToCache(cacheKey, documentImageUrl, { method: 'document-fallback' });
      }

      this.updateOperationMetrics('extractImageUrl', true);
      return result;
    }
    return null;
  }

  /**
   * Find image within container
   */

  private findImageInContainer(
    container: cheerio.Cheerio<any>,
    imageSelectors: string[]
  ): ParseResult<string> {
    for (const selector of imageSelectors) {
      this.logger?.debug(`Trying image selector: ${selector}`);
      const imgElement = container.find(selector).first();

      if (imgElement.length > 0) {
        const src = imgElement.attr('src') ?? imgElement.attr('data-src');
        this.logger?.debug(`Found image element with src: ${src}`);

        if (src && this.isValidImageUrl(src)) {
          this.logger?.debug(`Valid image URL found: ${src}`);
          return {
            success: true,
            value: src,
            selectorUsed: selector,
            fallbackUsed: false,
            attemptCount: 1,
            parseTime: 0,
          };
        } else if (src) {
          this.logger?.debug(`Invalid or filtered image URL: ${src}`);
        }
      }
    }

    return {
      success: false,
      fallbackUsed: false,
      attemptCount: imageSelectors.length,
      parseTime: 0,
    };
  }

  /**
   * Find image in document as fallback
   */
  private findImageInDocument($: cheerio.CheerioAPI, imageSelectors: string[]): string | null {
    this.logger?.debug('Falling back to document-wide image search...');

    for (const selector of imageSelectors) {
      const imgElement = $(selector).first();
      if (imgElement.length > 0) {
        const src = imgElement.attr('src') ?? imgElement.attr('data-src');
        if (src && this.isValidImageUrl(src) && (src.includes('patch') || src.includes('news'))) {
          this.logger?.debug(`Valid fallback image URL found: ${src}`);
          return src;
        }
      }
    }

    this.logger?.debug('No valid image URL found');
    return null;
  }

  /**
   * Validate image URL using ImageValidator if available
   */
  private isValidImageUrl(url: string): boolean {
    if (this.imageValidator) {
      return this.imageValidator.validateImageUrl(url).isValid;
    }

    // フォールバック: 基本的な検証
    return Boolean(url && url.length > 0 && (url.startsWith('http') || url.startsWith('data:')));
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    operation: string,
    content: string | undefined,
    selectors: string[]
  ): string {
    const contentHash = content ? content.substring(0, 100) : '';
    const selectorsStr = selectors.join(',');
    return `${operation}:${contentHash}:${selectorsStr}`;
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.config.cacheTimeout) {
      if (this.config.enableMetrics) {
        this.metrics.cacheHitRate =
          (this.metrics.cacheHitRate * this.metrics.totalParses + 1) /
          (this.metrics.totalParses + 1);
      }
      return entry.value;
    }

    if (entry) {
      this.cache.delete(key); // 期限切れエントリを削除
    }

    return null;
  }

  /**
   * Save to cache
   */
  private saveToCache<T>(key: string, value: T, metadata: Record<string, any>): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      metadata,
    });
  }

  /**
   * Create success result
   */
  private createSuccessResult<T>(
    value: T,
    selector: string,
    fallbackUsed: boolean,
    attemptCount: number,
    parseTime: number
  ): ParseResult<T> {
    return {
      success: true,
      value,
      selectorUsed: selector,
      fallbackUsed,
      attemptCount,
      parseTime,
      metadata: {
        timestamp: Date.now(),
        cached: false,
      },
    };
  }

  /**
   * Create failure result
   */
  private createFailureResult<T>(
    error: string,
    attemptCount: number,
    parseTime: number
  ): ParseResult<T> {
    return {
      success: false,
      fallbackUsed: false,
      attemptCount,
      parseTime,
      error,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Update selector metrics
   */
  private updateSelectorMetrics(selector: string, success: boolean): void {
    const currentRate = this.metrics.selectorSuccessRate[selector] || 0;
    const currentCount = this.metrics.operationDistribution[selector] || 0;

    this.metrics.selectorSuccessRate[selector] =
      (currentRate * currentCount + (success ? 1 : 0)) / (currentCount + 1);
    this.metrics.operationDistribution[selector] = currentCount + 1;
  }

  /**
   * Update operation metrics
   */
  private updateOperationMetrics(operation: string, success: boolean): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalParses++;
    if (success) {
      this.metrics.successfulParses++;
    } else {
      this.metrics.failedParses++;
    }

    const currentCount = this.metrics.operationDistribution[operation] || 0;
    this.metrics.operationDistribution[operation] = currentCount + 1;
  }

  /**
   * Service info for monitoring
   */
  public getServiceInfo(): {
    uptime: number;
    config: HtmlParserConfig;
    metrics: ParseMetrics;
    cacheSize: number;
  } {
    return {
      uptime: Date.now() - this.startTime,
      config: { ...this.config },
      metrics: this.getMetrics(),
      cacheSize: this.cache.size,
    };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.logger?.info('HtmlParser cache cleared');
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics.totalParses = 0;
    this.metrics.successfulParses = 0;
    this.metrics.failedParses = 0;
    this.metrics.averageParseTime = 0;
    this.metrics.selectorSuccessRate = {};
    this.metrics.fallbackUsageRate = 0;
    this.metrics.cacheHitRate = 0;
    this.metrics.operationDistribution = {};

    this.logger?.info('HtmlParser metrics reset');
  }

  // === 高度な解析機能 ===

  /**
   * XPath による解析（高度な機能）
   */
  public parseWithXPath(html: string, xpath: string): ParseResult<any[]> {
    const startTime = performance.now();

    if (!this.config.enableXPathSupport) {
      return this.createFailureResult<any[]>(
        'XPath support is disabled',
        1,
        performance.now() - startTime
      );
    }

    try {
      // XPath解析のシミュレーション（実際の実装では専用ライブラリを使用）
      const $ = require('cheerio').load(html);
      const results: any[] = [];

      // XPathをCSSセレクターに変換する基本的な実装
      const cssSelector = this.convertXPathToCSS(xpath);
      if (cssSelector) {
        $(cssSelector).each((_: number, el: any) => {
          results.push({
            tagName: $(el).prop('tagName')?.toLowerCase(),
            text: $(el).text(),
            attributes: this.extractAttributesFromElement($(el)),
            html: $(el).html(),
          });
        });
      }

      this.updateOperationMetrics('parseWithXPath', true);
      return this.createSuccessResult(results, xpath, false, 1, performance.now() - startTime);
    } catch (error) {
      this.updateOperationMetrics('parseWithXPath', false);
      const errorMessage = error instanceof Error ? error.message : 'XPath parsing failed';
      return this.createFailureResult<any[]>(errorMessage, 1, performance.now() - startTime);
    }
  }

  /**
   * 高度なパターンマッチング解析
   */
  public parseWithAdvancedPatterns(
    $: cheerio.CheerioAPI,
    patterns: AdvancedPattern[]
  ): ParseResult<PatternMatch[]> {
    const startTime = performance.now();

    if (!this.config.enableAdvancedPatterns) {
      return this.createFailureResult<PatternMatch[]>(
        'Advanced patterns are disabled',
        1,
        performance.now() - startTime
      );
    }

    try {
      const results: PatternMatch[] = [];

      // パターンを優先度順にソート
      const sortedPatterns = patterns.sort((a, b) => b.priority - a.priority);

      for (const pattern of sortedPatterns) {
        const patternStartTime = performance.now();
        const matches: PatternMatch['matches'] = [];

        // セレクターベースの検索
        for (const selector of pattern.selectors) {
          $(selector).each((index, element) => {
            const $el = $(element);

            // バリデーション
            if (pattern.validator && !pattern.validator($el)) {
              return;
            }

            // 値の変換
            const value = pattern.transformer ? pattern.transformer($el) : $el.text();

            // 正規表現マッチング
            if (pattern.regex && !pattern.regex.test(value)) {
              return;
            }

            matches.push({
              element: $el,
              value,
              confidence: this.calculateMatchConfidence($el, pattern),
              position: this.getElementPosition($el),
            });
          });
        }

        results.push({
          pattern: pattern.name,
          matches,
          totalMatches: matches.length,
          processingTime: performance.now() - patternStartTime,
        });
      }

      this.updateOperationMetrics('parseWithAdvancedPatterns', true);
      return this.createSuccessResult(
        results,
        'advanced-patterns',
        false,
        patterns.length,
        performance.now() - startTime
      );
    } catch (error) {
      this.updateOperationMetrics('parseWithAdvancedPatterns', false);
      const errorMessage =
        error instanceof Error ? error.message : 'Advanced pattern parsing failed';
      return this.createFailureResult<PatternMatch[]>(
        errorMessage,
        patterns.length,
        performance.now() - startTime
      );
    }
  }

  /**
   * コンテンツ分析機能
   */
  public analyzeContent(
    $: cheerio.CheerioAPI,
    options: ContentAnalysisOptions = {
      includeMetadata: true,
      analyzeSemantic: false,
      extractKeywords: true,
      detectLanguage: false,
      analyzeStructure: true,
      includeReadability: false,
    }
  ): ContentAnalysisResult {
    const startTime = performance.now();

    if (!this.config.enableContentAnalysis) {
      throw new Error('Content analysis is disabled');
    }

    try {
      const bodyText = $('body').text();
      const result: ContentAnalysisResult = {
        wordCount: this.countWords(bodyText),
        characterCount: bodyText.length,
        paragraphCount: $('p').length,
        headingCount: $('h1, h2, h3, h4, h5, h6').length,
        linkCount: $('a[href]').length,
        imageCount: $('img').length,
        keywords: [],
        semanticStructure: {
          sections: [],
          topics: [],
          entities: [],
        },
        metadata: {},
      };

      // メタデータ抽出
      if (options.includeMetadata) {
        const title = $('title').text() || $('h1').first().text();
        const description = $('meta[name="description"]').attr('content');
        const author = $('meta[name="author"]').attr('content');
        const publishDate = this.extractPublishDate($);

        result.metadata = {
          title,
          ...(description && { description }),
          ...(author && { author }),
          ...(publishDate && { publishDate }),
        };
      }

      // キーワード抽出
      if (options.extractKeywords) {
        result.keywords = this.extractKeywords(bodyText);
      }

      // 構造解析
      if (options.analyzeStructure) {
        result.semanticStructure = this.analyzeSemanticStructure($);
      }

      // 読みやすさ分析
      if (options.includeReadability) {
        result.readabilityScore = this.calculateReadabilityScore(bodyText);
      }

      // 言語検出
      if (options.detectLanguage) {
        result.language = this.detectLanguage(bodyText);
      }

      this.updateOperationMetrics('analyzeContent', true);
      this.logger?.debug('Content analysis completed', {
        wordCount: result.wordCount,
        duration: performance.now() - startTime,
      });

      return result;
    } catch (error) {
      this.updateOperationMetrics('analyzeContent', false);
      throw error;
    }
  }

  /**
   * ストリーミング解析（非同期生成）
   */
  public async *streamParse(
    htmlStream: ReadableStream,
    selectors: string[]
  ): AsyncGenerator<ParseResult<any>, void, unknown> {
    if (!this.config.enableStreamingParsing) {
      throw new Error('Streaming parsing is disabled');
    }

    const reader = htmlStream.getReader();
    let buffer = '';
    let position = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // 最後のチャンクを処理
          if (buffer.length > 0) {
            yield* this.processStreamChunk(buffer, selectors, position, true);
          }
          break;
        }

        buffer += new TextDecoder().decode(value);
        position += value.length;

        // チャンクサイズに達したら処理
        if (buffer.length >= this.config.streamChunkSize) {
          const chunk = buffer.substring(0, this.config.streamChunkSize);
          buffer = buffer.substring(this.config.streamChunkSize);

          yield* this.processStreamChunk(chunk, selectors, position - buffer.length, false);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * DOM操作機能
   */
  public manipulateDOM(
    $: cheerio.CheerioAPI,
    operations: DOMOperation[]
  ): ParseResult<cheerio.CheerioAPI> {
    const startTime = performance.now();

    if (!this.config.enableDomManipulation) {
      return this.createFailureResult<cheerio.CheerioAPI>(
        'DOM manipulation is disabled',
        1,
        performance.now() - startTime
      );
    }

    try {
      let successCount = 0;

      for (const operation of operations) {
        const element = $(operation.selector);

        if (element.length === 0) {
          this.logger?.warn(`DOM operation target not found: ${operation.selector}`);
          continue;
        }

        switch (operation.type) {
          case 'add':
            if (operation.content) {
              switch (operation.position) {
                case 'before':
                  element.before(operation.content);
                  break;
                case 'after':
                  element.after(operation.content);
                  break;
                case 'prepend':
                  element.prepend(operation.content);
                  break;
                case 'append':
                default:
                  element.append(operation.content);
                  break;
              }
            }
            break;

          case 'remove':
            element.remove();
            break;

          case 'modify':
            if (operation.attributes) {
              Object.entries(operation.attributes).forEach(([key, value]) => {
                element.attr(key, value);
              });
            }
            if (operation.content) {
              element.text(operation.content);
            }
            break;

          case 'replace':
            if (operation.content) {
              element.replaceWith(operation.content);
            }
            break;
        }

        successCount++;
      }

      this.updateOperationMetrics('manipulateDOM', true);
      return this.createSuccessResult(
        $,
        'dom-manipulation',
        false,
        operations.length,
        performance.now() - startTime
      );
    } catch (error) {
      this.updateOperationMetrics('manipulateDOM', false);
      const errorMessage = error instanceof Error ? error.message : 'DOM manipulation failed';
      return this.createFailureResult<cheerio.CheerioAPI>(
        errorMessage,
        operations.length,
        performance.now() - startTime
      );
    }
  }

  /**
   * 並列解析機能
   */
  public async parallelParse(
    $: cheerio.CheerioAPI,
    tasks: ParsingTask[]
  ): Promise<ParseResult<any>[]> {
    const startTime = performance.now();

    if (!this.config.enableParallelParsing) {
      throw new Error('Parallel parsing is disabled');
    }

    try {
      // タスクを優先度順にソート
      const sortedTasks = tasks.sort((a, b) => b.priority - a.priority);

      // 並列実行の制限
      const maxConcurrent = Math.min(this.config.maxParallelTasks, tasks.length);
      const results: ParseResult<any>[] = [];

      // タスクをバッチに分割
      for (let i = 0; i < sortedTasks.length; i += maxConcurrent) {
        const batch = sortedTasks.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(async task => {
          const taskStartTime = performance.now();

          try {
            let result: any;

            switch (task.type) {
              case 'extract':
                result = this.executeExtractionTask($, task);
                break;
              case 'search':
                result = this.executeSearchTask($, task);
                break;
              case 'analyze':
                result = this.executeAnalysisTask($, task);
                break;
              default:
                throw new Error(`Unknown task type: ${task.type}`);
            }

            return this.createSuccessResult(
              result,
              task.id,
              false,
              1,
              performance.now() - taskStartTime
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Task execution failed';
            return this.createFailureResult<any>(
              errorMessage,
              1,
              performance.now() - taskStartTime
            );
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      this.updateOperationMetrics('parallelParse', true);
      this.logger?.debug(`Parallel parsing completed`, {
        totalTasks: tasks.length,
        successfulTasks: results.filter(r => r.success).length,
        duration: performance.now() - startTime,
      });

      return results;
    } catch (error) {
      this.updateOperationMetrics('parallelParse', false);
      throw error;
    }
  }

  // === 高度な解析のヘルパーメソッド ===

  private convertXPathToCSS(xpath: string): string | null {
    // 基本的なXPath-CSS変換（実際の実装では専用ライブラリを使用）
    const conversions: Record<string, string> = {
      '//div': 'div',
      '//span': 'span',
      '//a': 'a',
      '//img': 'img',
      '//*[@class]': '[class]',
      '//*[@id]': '[id]',
    };

    return conversions[xpath] || null;
  }

  private extractAttributesFromElement(element: cheerio.Cheerio<any>): Record<string, string> {
    const attributes: Record<string, string> = {};

    if (element.length > 0) {
      const el = element.get(0);
      if (el && 'attribs' in el && el.attribs) {
        Object.assign(attributes, el.attribs);
      }
    }

    return attributes;
  }

  private calculateMatchConfidence(
    element: cheerio.Cheerio<any>,
    pattern: AdvancedPattern
  ): number {
    let confidence = 0.5; // ベースライン

    // セレクターの特異性に基づく信頼度
    const hasId = element.attr('id');
    const hasClass = element.attr('class');
    const hasUniqueText = element.text().trim().length > 0;

    if (hasId) confidence += 0.3;
    if (hasClass) confidence += 0.2;
    if (hasUniqueText) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  private getElementPosition(element: cheerio.Cheerio<any>): { x: number; y: number } {
    // 簡易的な位置計算（実際の実装では詳細な計算を行う）
    let x = 0;
    let y = 0;

    let current = element;
    while (current.length > 0 && current.parent().length > 0) {
      const siblings = current.prevAll();
      x += siblings.length * 10; // 簡易計算
      y += 20; // 深度に基づく簡易計算
      current = current.parent();
    }

    return { x, y };
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }

  private extractKeywords(text: string): string[] {
    // 簡易的なキーワード抽出
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private analyzeSemanticStructure($: cheerio.CheerioAPI): {
    sections: string[];
    topics: string[];
    entities: string[];
  } {
    const sections = $('section, article, div[role="main"]')
      .map((_, el) => $(el).attr('id') || $(el).attr('class') || 'unnamed')
      .get();

    const topics = $('h1, h2, h3')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(text => text.length > 0);

    // 簡易的なエンティティ検出（実際の実装ではNLPライブラリを使用）
    const entities = $('[data-entity], .entity, .person, .organization')
      .map((_, el) => $(el).text().trim())
      .get();

    return { sections, topics, entities };
  }

  private calculateReadabilityScore(text: string): number {
    // 簡易的な読みやすさスコア（Flesch Reading Ease の簡易版）
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const words = this.countWords(text);
    const syllables = this.countSyllables(text);

    if (sentences === 0 || words === 0) return 0;

    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    return Math.max(0, Math.min(100, score));
  }

  private countSyllables(text: string): number {
    // 簡易的な音節数計算
    return (
      text
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .replace(/[aeiouy]+/g, 'a')
        .replace(/[^a]/g, '').length || 1
    );
  }

  private detectLanguage(text: string): string {
    // 簡易的な言語検出
    const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars === 0) return 'unknown';

    const japaneseRatio = japaneseChars / totalChars;
    return japaneseRatio > 0.1 ? 'ja' : 'en';
  }

  private extractPublishDate($: cheerio.CheerioAPI): Date | undefined {
    const dateSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="publish_date"]',
      'time[datetime]',
      '.publish-date',
      '.date',
    ];

    for (const selector of dateSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const dateStr = element.attr('content') || element.attr('datetime') || element.text();
        if (dateStr) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }

    return undefined;
  }

  private async *processStreamChunk(
    chunk: string,
    selectors: string[],
    position: number,
    isComplete: boolean
  ): AsyncGenerator<ParseResult<any>, void, unknown> {
    try {
      const $ = require('cheerio').load(chunk);

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          yield this.createSuccessResult(
            {
              selector,
              elements: elements
                .map((_: number, el: any) => ({
                  text: $(el).text(),
                  html: $(el).html(),
                  attributes: this.extractAttributesFromElement($(el)),
                }))
                .get(),
              position,
              isComplete,
            },
            selector,
            false,
            1,
            0
          );
        }
      }
    } catch (error) {
      yield this.createFailureResult<any>(
        error instanceof Error ? error.message : 'Stream chunk processing failed',
        1,
        0
      );
    }
  }

  private executeExtractionTask($: cheerio.CheerioAPI, task: ParsingTask): any {
    const results: any[] = [];

    for (const selector of task.selectors) {
      $(selector).each((_, el) => {
        results.push({
          text: $(el).text(),
          html: $(el).html(),
          attributes: this.extractAttributesFromElement($(el)),
        });
      });
    }

    return { taskId: task.id, results };
  }

  private executeSearchTask($: cheerio.CheerioAPI, task: ParsingTask): any {
    const matches: any[] = [];

    for (const selector of task.selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        matches.push({
          selector,
          count: elements.length,
          elements: elements.map((_, el) => $(el).text()).get(),
        });
      }
    }

    return { taskId: task.id, matches };
  }

  private executeAnalysisTask($: cheerio.CheerioAPI, task: ParsingTask): any {
    const analysis: any = {
      taskId: task.id,
      selectors: task.selectors,
      results: {},
    };

    for (const selector of task.selectors) {
      const elements = $(selector);
      analysis.results[selector] = {
        count: elements.length,
        avgTextLength:
          elements.length > 0
            ? elements
                .map((_, el) => $(el).text().length)
                .get()
                .reduce((a, b) => a + b, 0) / elements.length
            : 0,
        hasImages: elements.find('img').length > 0,
        hasLinks: elements.find('a').length > 0,
      };
    }

    return analysis;
  }
}
