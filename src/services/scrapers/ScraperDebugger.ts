/**
 * Enhanced ScraperDebugger service
 * エンタープライズ級スクレイピングデバッグサービス - DI対応版
 */

import type * as cheerio from 'cheerio';
import { Logger } from '../../utils/logger';

/**
 * デバッグセッション情報
 */
export interface DebugSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  url?: string;
  operations: DebugOperation[];
  metrics: DebugMetrics;
  context: Record<string, any>;
}

/**
 * デバッグ操作記録
 */
export interface DebugOperation {
  id: string;
  type: DebugOperationType;
  timestamp: Date;
  duration?: number;
  data: any;
  result?: any;
  error?: string;
}

/**
 * デバッグ操作種別
 */
export enum DebugOperationType {
  PAGE_STRUCTURE = 'page_structure',
  PATCH_ELEMENT = 'patch_element',
  IMAGE_ANALYSIS = 'image_analysis',
  DOM_QUERY = 'dom_query',
  VALIDATION = 'validation',
  CUSTOM = 'custom',
}

/**
 * デバッグメトリクス
 */
export interface DebugMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageOperationTime: number;
  memoryUsage?: number;
  sessionDuration: number;
}

/**
 * ページ構造分析結果
 */
export interface PageStructureAnalysis {
  totalElements: number;
  availableClasses: string[];
  gridContainers: ElementInfo[];
  imageElements: ImageElementInfo[];
  linkElements: LinkElementInfo[];
  structureDepth: number;
  uniqueSelectors: string[];
}

/**
 * パッチ要素分析結果
 */
export interface PatchElementAnalysis {
  elementCount: number;
  tagName: string;
  classes: string[];
  attributes: Record<string, string>;
  children: ElementInfo[];
  textContent: string;
  href?: string;
  isValid: boolean;
}

/**
 * 画像分析結果
 */
export interface ImageAnalysis {
  totalImages: number;
  validImages: number;
  invalidImages: number;
  imageDetails: ImageElementInfo[];
  formats: Record<string, number>;
  sizes: { min: number; max: number; average: number };
}

/**
 * 要素情報
 */
export interface ElementInfo {
  tagName: string;
  classes: string[];
  attributes: Record<string, string>;
  textContent: string;
  childCount: number;
}

/**
 * 画像要素情報
 */
export interface ImageElementInfo extends ElementInfo {
  src?: string;
  dataSrc?: string;
  alt?: string;
  format?: string;
  isValid: boolean;
}

/**
 * リンク要素情報
 */
export interface LinkElementInfo extends ElementInfo {
  href?: string;
  target?: string;
  rel?: string;
  isExternal: boolean;
}

/**
 * エクスポート形式
 */
export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  HTML = 'html',
}

/**
 * デバッグ設定
 */
export interface DebuggerConfig {
  maxSessions: number;
  sessionTimeout: number; // ms
  enableMetrics: boolean;
  enableAutoExport: boolean;
  exportFormat: ExportFormat;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * ScraperDebuggerインターフェース
 */
export interface ScraperDebuggerInterface {
  startSession(url?: string, context?: Record<string, any>): string;
  endSession(sessionId: string): DebugSession | null;
  analyzePageStructure($: cheerio.CheerioAPI, sessionId?: string): PageStructureAnalysis;
  analyzePatchElements(
    $: cheerio.CheerioAPI,
    patchElement: cheerio.Cheerio<any>,
    sessionId?: string
  ): PatchElementAnalysis;
  analyzeImages(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    sessionId?: string
  ): ImageAnalysis;
  exportSession(sessionId: string, format: ExportFormat): string;
  getSessionMetrics(sessionId: string): DebugMetrics | null;
}

/**
 * エンタープライズ級スクレイピングデバッグサービス
 * セッション管理、構造化分析、パフォーマンス監視機能付き
 */
export class ScraperDebugger implements ScraperDebuggerInterface {
  private static readonly SIXTY_CONSTANT = 60;
  private static readonly THIRTY_CONSTANT = 30;
  private static readonly TWENTY_CONSTANT = 20;
  private static readonly EIGHT_CONSTANT = 8;
  private static readonly THIRTY_SIX_CONSTANT = 36;
  private static readonly MAX_DEBUG_CLASSES = ScraperDebugger.TWENTY_CONSTANT;
  private static readonly ID_RANDOM_LENGTH = ScraperDebugger.THIRTY_SIX_CONSTANT;
  private static readonly ID_SUBSTRING_START = 2;
  private static readonly ID_SUBSTRING_LENGTH = ScraperDebugger.EIGHT_CONSTANT;
  private static readonly SESSION_CLEANUP_INTERVAL = 5 * ScraperDebugger.SIXTY_CONSTANT * 1000; // 5分
  private static readonly DEFAULT_SESSION_TIMEOUT =
    ScraperDebugger.THIRTY_CONSTANT * ScraperDebugger.SIXTY_CONSTANT * 1000; // 30分
  private static readonly MAX_AVAILABLE_CLASSES = 50;
  private static readonly MAX_UNIQUE_SELECTORS = 100;
  private static readonly MAX_TEXT_CONTENT = 200;
  private static readonly MAX_TEXT_CONTENT_SHORT = 100;
  private static readonly DEFAULT_MAX_SESSIONS = 10;
  private readonly sessions = new Map<string, DebugSession>();
  private readonly config: DebuggerConfig;
  private readonly startTime: number;

  constructor(
    config?: Partial<DebuggerConfig>,
    private readonly logger?: typeof Logger
  ) {
    this.startTime = Date.now();

    // デフォルト設定
    this.config = {
      maxSessions: ScraperDebugger.DEFAULT_MAX_SESSIONS,
      sessionTimeout: ScraperDebugger.DEFAULT_SESSION_TIMEOUT,
      enableMetrics: true,
      enableAutoExport: false,
      exportFormat: ExportFormat.JSON,
      logLevel: 'debug',
      ...config,
    };

    this.logger?.debug('ScraperDebugger initialized with config:', this.config);

    // セッションクリーンアップの定期実行
    this.startSessionCleanup();
  }

  /**
   * デバッグセッション開始
   */
  public startSession(url?: string, context: Record<string, any> = {}): string {
    const sessionId = this.generateSessionId();
    const session: DebugSession = {
      id: sessionId,
      startTime: new Date(),
      ...(url && { url }),
      operations: [],
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageOperationTime: 0,
        sessionDuration: 0,
      },
      context,
    };

    // セッション数制限チェック
    if (this.sessions.size >= this.config.maxSessions) {
      this.cleanupOldestSession();
    }

    this.sessions.set(sessionId, session);
    this.logger?.debug(`Debug session started: ${sessionId}`, { url, context });

    return sessionId;
  }

  /**
   * デバッグセッション終了
   */
  public endSession(sessionId: string): DebugSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger?.warn(`Session not found: ${sessionId}`);
      return null;
    }

    session.endTime = new Date();
    session.metrics.sessionDuration = session.endTime.getTime() - session.startTime.getTime();

    this.logger?.debug(`Debug session ended: ${sessionId}`, {
      duration: session.metrics.sessionDuration,
      operations: session.metrics.totalOperations,
    });

    // 自動エクスポート
    if (this.config.enableAutoExport) {
      try {
        this.exportSession(sessionId, this.config.exportFormat);
      } catch (error) {
        this.logger?.error(`Auto-export failed for session ${sessionId}:`, error);
      }
    }

    return session;
  }

  /**
   * ページ構造分析（詳細版）
   */
  public analyzePageStructure($: cheerio.CheerioAPI, sessionId?: string): PageStructureAnalysis {
    const startTime = performance.now();

    try {
      const analysis: PageStructureAnalysis = {
        totalElements: $('*').length,
        availableClasses: this.extractAvailableClasses($),
        gridContainers: this.analyzeGridContainers($),
        imageElements: this.analyzeImageElements($),
        linkElements: this.analyzeLinkElements($),
        structureDepth: this.calculateStructureDepth($),
        uniqueSelectors: this.generateUniqueSelectors($),
      };

      const duration = performance.now() - startTime;

      if (sessionId) {
        this.recordOperation(sessionId, {
          id: this.generateOperationId(),
          type: DebugOperationType.PAGE_STRUCTURE,
          timestamp: new Date(),
          duration,
          data: { elementCount: analysis.totalElements },
          result: analysis,
        });
      }

      this.logger?.debug('Page structure analyzed', {
        totalElements: analysis.totalElements,
        classes: analysis.availableClasses.length,
        duration,
      });

      return analysis;
    } catch (error) {
      const duration = performance.now() - startTime;

      if (sessionId) {
        this.recordOperation(sessionId, {
          id: this.generateOperationId(),
          type: DebugOperationType.PAGE_STRUCTURE,
          timestamp: new Date(),
          duration,
          data: {},
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    }
  }

  /**
   * パッチ要素分析（詳細版）
   */
  public analyzePatchElements(
    $: cheerio.CheerioAPI,
    patchElement: cheerio.Cheerio<any>,
    sessionId?: string
  ): PatchElementAnalysis {
    const startTime = performance.now();

    try {
      const analysis = this.buildPatchElementAnalysis($, patchElement);
      const duration = performance.now() - startTime;

      this.recordPatchElementOperation(sessionId, analysis, duration);
      this.logPatchElementAnalysis(analysis, duration);

      return analysis;
    } catch (error) {
      this.handlePatchElementError(sessionId, startTime, error);
      throw error;
    }
  }

  /**
   * 画像分析（詳細版）
   */
  public analyzeImages(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    sessionId?: string
  ): ImageAnalysis {
    const startTime = performance.now();

    try {
      const allImages = container.find('img');
      const imageDetails = this.extractImageDetails($, allImages);

      const analysis: ImageAnalysis = {
        totalImages: allImages.length,
        validImages: imageDetails.filter(img => img.isValid).length,
        invalidImages: imageDetails.filter(img => !img.isValid).length,
        imageDetails,
        formats: this.calculateFormatDistribution(imageDetails),
        sizes: this.calculateSizeStatistics(imageDetails),
      };

      const duration = performance.now() - startTime;

      if (sessionId) {
        this.recordOperation(sessionId, {
          id: this.generateOperationId(),
          type: DebugOperationType.IMAGE_ANALYSIS,
          timestamp: new Date(),
          duration,
          data: { totalImages: analysis.totalImages },
          result: analysis,
        });
      }

      this.logger?.debug('Images analyzed', {
        totalImages: analysis.totalImages,
        validImages: analysis.validImages,
        formats: Object.keys(analysis.formats),
        duration,
      });

      return analysis;
    } catch (error) {
      const duration = performance.now() - startTime;

      if (sessionId) {
        this.recordOperation(sessionId, {
          id: this.generateOperationId(),
          type: DebugOperationType.IMAGE_ANALYSIS,
          timestamp: new Date(),
          duration,
          data: {},
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    }
  }

  /**
   * セッションエクスポート
   */
  public exportSession(sessionId: string, format: ExportFormat): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    switch (format) {
      case ExportFormat.JSON:
        return JSON.stringify(session, null, 2);

      case ExportFormat.CSV:
        return this.exportToCSV(session);

      case ExportFormat.HTML:
        return this.exportToHTML(session);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * セッションメトリクス取得
   */
  public getSessionMetrics(sessionId: string): DebugMetrics | null {
    const session = this.sessions.get(sessionId);
    return session ? { ...session.metrics } : null;
  }

  // === 後方互換性メソッド ===

  /**
   * デバッグ用：ページ構造をログ出力（後方互換性）
   */
  public logPageStructure($: cheerio.CheerioAPI): void {
    const analysis = this.analyzePageStructure($);

    Logger.debug(`Total elements found: ${analysis.totalElements}`);
    Logger.debug(
      `Available classes: ${analysis.availableClasses
        .slice(0, ScraperDebugger.MAX_DEBUG_CLASSES)
        .join(', ')}`
    );

    Logger.debug(`Grid containers found: ${analysis.gridContainers.length}`);
    analysis.gridContainers.forEach((container, i) => {
      Logger.debug(
        `Grid ${i}: classes="${container.classes.join(' ')}", children=${container.childCount}`
      );
    });
  }

  /**
   * デバッグ用：パッチ要素情報をログ出力（後方互換性）
   */
  public logPatchElement($: cheerio.CheerioAPI, patchElement: cheerio.Cheerio<any>): void {
    const analysis = this.analyzePatchElements($, patchElement);

    Logger.debug(`Found patch element with tag: ${analysis.tagName}`);
    Logger.debug(`Patch element classes: ${analysis.classes.join(' ')}`);
    Logger.debug(`Patch element children: ${analysis.children.length}`);
    Logger.debug(`Patch element href: ${analysis.href}`);
    Logger.debug(`Patch element text: ${analysis.textContent}...`);

    analysis.children.forEach((child, i) => {
      Logger.debug(
        `  Child ${i}: tag=${child.tagName}, classes="${child.classes.join(' ')}", text="${child.textContent.substring(0, 100)}..."`
      );
    });
  }

  /**
   * コンテナ内の画像情報をログ出力（後方互換性）
   */
  public logContainerImages($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>): void {
    const analysis = this.analyzeImages($, container);

    Logger.debug(`Total images in container: ${analysis.totalImages}`);
    analysis.imageDetails.forEach((img, i) => {
      Logger.debug(
        `  Image ${i}: src="${img.src ?? img.dataSrc}", classes="${img.classes.join(' ')}"`
      );
    });
  }

  // === セッション管理機能 ===

  /**
   * アクティブセッション一覧取得
   */
  public getActiveSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * セッション詳細取得
   */
  public getSession(sessionId: string): DebugSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * 全セッションクリア
   */
  public clearAllSessions(): void {
    this.sessions.clear();
    this.logger?.debug('All debug sessions cleared');
  }

  // === プライベートメソッド ===

  private buildPatchElementAnalysis(
    $: cheerio.CheerioAPI,
    patchElement: cheerio.Cheerio<any>
  ): PatchElementAnalysis {
    const hrefAttr = patchElement.attr('href');
    return {
      elementCount: patchElement.length,
      tagName:
        patchElement.length > 0
          ? (patchElement.prop('tagName')?.toLowerCase() ?? 'unknown')
          : 'none',
      classes: (patchElement.attr('class') ?? '').split(' ').filter(Boolean),
      attributes: this.extractAttributes(patchElement),
      children: this.analyzeChildren($, patchElement),
      textContent: patchElement.text().substring(0, ScraperDebugger.MAX_TEXT_CONTENT),
      ...(hrefAttr && { href: hrefAttr }),
      isValid: patchElement.length > 0 && Boolean(patchElement.text().trim()),
    };
  }

  private recordPatchElementOperation(
    sessionId: string | undefined,
    analysis: PatchElementAnalysis,
    duration: number
  ): void {
    if (sessionId) {
      this.recordOperation(sessionId, {
        id: this.generateOperationId(),
        type: DebugOperationType.PATCH_ELEMENT,
        timestamp: new Date(),
        duration,
        data: { elementCount: analysis.elementCount, tagName: analysis.tagName },
        result: analysis,
      });
    }
  }

  private logPatchElementAnalysis(analysis: PatchElementAnalysis, duration: number): void {
    this.logger?.debug('Patch element analyzed', {
      elementCount: analysis.elementCount,
      tagName: analysis.tagName,
      isValid: analysis.isValid,
      duration,
    });
  }

  private handlePatchElementError(
    sessionId: string | undefined,
    startTime: number,
    error: unknown
  ): void {
    const duration = performance.now() - startTime;

    if (sessionId) {
      this.recordOperation(sessionId, {
        id: this.generateOperationId(),
        type: DebugOperationType.PATCH_ELEMENT,
        timestamp: new Date(),
        duration,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private generateSessionId(): string {
    return `debug_${Date.now()}_${Math.random().toString(ScraperDebugger.ID_RANDOM_LENGTH).substring(ScraperDebugger.ID_SUBSTRING_START, ScraperDebugger.ID_SUBSTRING_LENGTH)}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(ScraperDebugger.ID_RANDOM_LENGTH).substring(ScraperDebugger.ID_SUBSTRING_START, ScraperDebugger.ID_SUBSTRING_LENGTH)}`;
  }

  private recordOperation(sessionId: string, operation: DebugOperation): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.operations.push(operation);
    session.metrics.totalOperations++;

    if (operation.error) {
      session.metrics.failedOperations++;
    } else {
      session.metrics.successfulOperations++;
    }

    if (operation.duration !== undefined) {
      session.metrics.averageOperationTime =
        (session.metrics.averageOperationTime * (session.metrics.totalOperations - 1) +
          operation.duration) /
        session.metrics.totalOperations;
    }
  }

  private extractAvailableClasses($: cheerio.CheerioAPI): string[] {
    const classes = new Set<string>();
    $('[class]').each((_, el) => {
      const classAttr = $(el).attr('class');
      if (classAttr) {
        classAttr.split(' ').forEach(cls => {
          if (cls.trim()) classes.add(cls.trim());
        });
      }
    });

    return Array.from(classes).slice(0, ScraperDebugger.MAX_AVAILABLE_CLASSES); // 最大50個
  }

  private analyzeGridContainers($: cheerio.CheerioAPI): ElementInfo[] {
    const gridContainers: ElementInfo[] = [];

    $('.sc-4d29e6fd-0').each((_, el) => {
      const $el = $(el);
      gridContainers.push({
        tagName: $el.prop('tagName')?.toLowerCase() ?? 'unknown',
        classes: ($el.attr('class') ?? '').split(' ').filter(Boolean),
        attributes: this.extractAttributes($el),
        textContent: $el.text().substring(0, ScraperDebugger.MAX_TEXT_CONTENT_SHORT),
        childCount: $el.children().length,
      });
    });

    return gridContainers;
  }

  private analyzeImageElements($: cheerio.CheerioAPI): ImageElementInfo[] {
    const images: ImageElementInfo[] = [];

    $('img').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src') ?? $el.attr('data-src');

      const srcAttr = $el.attr('src');
      const dataSrcAttr = $el.attr('data-src');
      const altAttr = $el.attr('alt');
      const format = this.extractImageFormat(src);

      images.push({
        tagName: 'img',
        classes: ($el.attr('class') ?? '').split(' ').filter(Boolean),
        attributes: this.extractAttributes($el),
        textContent: altAttr ?? '',
        childCount: 0,
        ...(srcAttr && { src: srcAttr }),
        ...(dataSrcAttr && { dataSrc: dataSrcAttr }),
        ...(altAttr && { alt: altAttr }),
        ...(format && { format }),
        isValid: Boolean(src && src.length > 0),
      });
    });

    return images;
  }

  private analyzeLinkElements($: cheerio.CheerioAPI): LinkElementInfo[] {
    const links: LinkElementInfo[] = [];

    $('a[href]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') ?? '';

      const targetAttr = $el.attr('target');
      const relAttr = $el.attr('rel');

      links.push({
        tagName: 'a',
        classes: ($el.attr('class') ?? '').split(' ').filter(Boolean),
        attributes: this.extractAttributes($el),
        textContent: $el.text().substring(0, ScraperDebugger.MAX_TEXT_CONTENT_SHORT),
        childCount: $el.children().length,
        href,
        ...(targetAttr && { target: targetAttr }),
        ...(relAttr && { rel: relAttr }),
        isExternal: href.startsWith('http://') || href.startsWith('https://'),
      });
    });

    return links;
  }

  private calculateStructureDepth($: cheerio.CheerioAPI): number {
    let maxDepth = 0;

    const calculateDepth = (element: cheerio.Cheerio<any>, currentDepth: number): void => {
      maxDepth = Math.max(maxDepth, currentDepth);
      element.children().each((_, child) => {
        calculateDepth($(child), currentDepth + 1);
      });
    };

    $('body').each((_, body) => {
      calculateDepth($(body), 1);
    });

    return maxDepth;
  }

  private generateUniqueSelectors($: cheerio.CheerioAPI): string[] {
    const selectors = new Set<string>();

    // ID selectors
    $('[id]').each((_, el) => {
      const id = $(el).attr('id');
      if (id) selectors.add(`#${id}`);
    });

    // Class selectors
    $('[class]').each((_, el) => {
      const classes = $(el).attr('class')?.split(' ').filter(Boolean) ?? [];
      classes.forEach(cls => selectors.add(`.${cls}`));
    });

    return Array.from(selectors).slice(0, ScraperDebugger.MAX_UNIQUE_SELECTORS);
  }

  private extractAttributes(element: cheerio.Cheerio<any>): Record<string, string> {
    const attributes: Record<string, string> = {};

    if (element.length > 0) {
      const el = element.get(0);
      if (el && 'attribs' in el && el.attribs) {
        Object.assign(attributes, el.attribs);
      }
    }

    return attributes;
  }

  private analyzeChildren($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): ElementInfo[] {
    const children: ElementInfo[] = [];

    element.children().each((_, child) => {
      const $child = $(child);
      children.push({
        tagName: $child.prop('tagName')?.toLowerCase() ?? 'unknown',
        classes: ($child.attr('class') ?? '').split(' ').filter(Boolean),
        attributes: this.extractAttributes($child),
        textContent: $child.text().substring(0, ScraperDebugger.MAX_TEXT_CONTENT_SHORT),
        childCount: $child.children().length,
      });
    });

    return children;
  }

  private extractImageDetails(
    $: cheerio.CheerioAPI,
    images: cheerio.Cheerio<any>
  ): ImageElementInfo[] {
    const details: ImageElementInfo[] = [];

    images.each((_, img) => {
      const $img = $(img);
      const src = $img.attr('src') ?? $img.attr('data-src');

      const srcAttr = $img.attr('src');
      const dataSrcAttr = $img.attr('data-src');
      const altAttr = $img.attr('alt');
      const format = this.extractImageFormat(src);

      details.push({
        tagName: 'img',
        classes: ($img.attr('class') ?? '').split(' ').filter(Boolean),
        attributes: this.extractAttributes($img),
        textContent: altAttr ?? '',
        childCount: 0,
        ...(srcAttr && { src: srcAttr }),
        ...(dataSrcAttr && { dataSrc: dataSrcAttr }),
        ...(altAttr && { alt: altAttr }),
        ...(format && { format }),
        isValid: Boolean(src && src.length > 0),
      });
    });

    return details;
  }

  private extractImageFormat(src?: string): string | undefined {
    if (!src) return undefined;

    const match = src.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
    return match?.[1]?.toLowerCase();
  }

  private calculateFormatDistribution(images: ImageElementInfo[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    images.forEach(img => {
      if (img.format) {
        distribution[img.format] = (distribution[img.format] ?? 0) + 1;
      }
    });

    return distribution;
  }

  private calculateSizeStatistics(images: ImageElementInfo[]): {
    min: number;
    max: number;
    average: number;
  } {
    const sizes = images.map(img => (img.src ?? img.dataSrc ?? '').length).filter(size => size > 0);

    if (sizes.length === 0) {
      return { min: 0, max: 0, average: 0 };
    }

    return {
      min: Math.min(...sizes),
      max: Math.max(...sizes),
      average: sizes.reduce((sum, size) => sum + size, 0) / sizes.length,
    };
  }

  private exportToCSV(session: DebugSession): string {
    const headers = ['operation_id', 'type', 'timestamp', 'duration', 'success', 'error'];
    const rows = session.operations.map(op => [
      op.id,
      op.type,
      op.timestamp.toISOString(),
      op.duration?.toString() ?? '',
      op.error ? 'false' : 'true',
      op.error ?? '',
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private exportToHTML(session: DebugSession): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Debug Session ${session.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .metrics { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9ecef; padding: 10px; border-radius: 3px; }
        .operations { margin-top: 20px; }
        .operation { border: 1px solid #ddd; margin: 10px 0; padding: 10px; border-radius: 3px; }
        .error { background: #ffe6e6; }
        .success { background: #e6ffe6; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Debug Session: ${session.id}</h1>
        <p>Started: ${session.startTime.toISOString()}</p>
        <p>URL: ${session.url ?? 'N/A'}</p>
        <p>Duration: ${session.metrics.sessionDuration}ms</p>
    </div>
    
    <div class="metrics">
        <div class="metric">Total: ${session.metrics.totalOperations}</div>
        <div class="metric">Success: ${session.metrics.successfulOperations}</div>
        <div class="metric">Failed: ${session.metrics.failedOperations}</div>
        <div class="metric">Avg Time: ${session.metrics.averageOperationTime.toFixed(2)}ms</div>
    </div>
    
    <div class="operations">
        <h2>Operations</h2>
        ${session.operations
          .map(
            op => `
            <div class="operation ${op.error ? 'error' : 'success'}">
                <strong>${op.type}</strong> (${op.id})
                <br>Time: ${op.timestamp.toISOString()}
                <br>Duration: ${op.duration ?? 0}ms
                ${op.error ? `<br>Error: ${op.error}` : ''}
            </div>
        `
          )
          .join('')}
    </div>
</body>
</html>`;
  }

  private cleanupOldestSession(): void {
    let oldestSession: DebugSession | null = null;
    let oldestSessionId = '';

    for (const [sessionId, session] of this.sessions) {
      if (!oldestSession || session.startTime < oldestSession.startTime) {
        oldestSession = session;
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      this.sessions.delete(oldestSessionId);
      this.logger?.debug(`Cleaned up oldest session: ${oldestSessionId}`);
    }
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const toDelete: string[] = [];

      for (const [sessionId, session] of this.sessions) {
        const sessionAge = now - session.startTime.getTime();
        if (sessionAge > this.config.sessionTimeout) {
          toDelete.push(sessionId);
        }
      }

      toDelete.forEach(sessionId => {
        this.sessions.delete(sessionId);
        this.logger?.debug(`Session expired: ${sessionId}`);
      });
    }, ScraperDebugger.SESSION_CLEANUP_INTERVAL);
  }
}
