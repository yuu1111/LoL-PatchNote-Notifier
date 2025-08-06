/**
 * PatchScraper service
 * パッチノートのスクレイピングを統括するメインサービス
 *
 * 責任範囲:
 * - パッチ情報取得フローの調整
 * - 外部APIとの通信管理
 * - 取得データの統合
 */

// External dependencies
import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

// Internal utilities
import { httpClient } from '../utils/httpClient';
import { Logger } from '../utils/logger';
import { config } from '../config';

// Type definitions
import { type PatchNote, ScrapingError } from '../types';
import {
  type DetailedPatchInfo,
  type ExtractedPatchData,
  type PatchScraperConfig,
  type SelectorSet,
} from './types/PatchScraperTypes';

// Service dependencies (injected)
import { HtmlParser } from './scrapers/HtmlParser';
import { ImageValidator } from './scrapers/ImageValidator';
import { ScraperDebugger } from './scrapers/ScraperDebugger';

// Re-export types for external use
export type { PatchScraperConfig } from './types/PatchScraperTypes';

/**
 * パッチノートスクレイピングのメインサービス
 * 各種スクレイピングサービスを統合し、パッチ情報を取得する
 */
export class PatchScraper {
  private readonly htmlParser: HtmlParser;
  private readonly imageValidator: ImageValidator;
  private scraperDebugger: ScraperDebugger | null;
  private selectors: SelectorSet;
  private isDebugMode: boolean;
  private detailPageTimeout: number;

  constructor(
    htmlParser?: HtmlParser,
    imageValidator?: ImageValidator,
    scraperDebugger?: ScraperDebugger | null,
    config?: PatchScraperConfig
  ) {
    // 依存性注入またはデフォルトインスタンス作成
    this.htmlParser = htmlParser ?? new HtmlParser();
    this.imageValidator = imageValidator ?? new ImageValidator();

    // プロパティの初期化
    this.isDebugMode = false;
    this.scraperDebugger = null;
    this.detailPageTimeout = 30000;
    this.selectors = this.getDefaultSelectors();

    // 設定の初期化
    this.initializeConfiguration(scraperDebugger, config);
  }

  /**
   * 設定の初期化（複雑度を下げるため分離）
   */
  private initializeConfiguration(
    scraperDebugger?: ScraperDebugger | null,
    config?: PatchScraperConfig
  ): void {
    // デバッグモードの判定
    this.isDebugMode = config?.debugMode ?? process.env.SCRAPER_DEBUG === 'true';
    this.scraperDebugger = scraperDebugger ?? (this.isDebugMode ? new ScraperDebugger() : null);

    // タイムアウト設定
    this.detailPageTimeout = config?.detailPageTimeout ?? 30000;

    // セレクタセット（デフォルトまたはカスタム）
    this.selectors = config?.selectors ?? this.getDefaultSelectors();
  }

  /**
   * デフォルトのセレクタセットを取得
   */
  private getDefaultSelectors(): SelectorSet {
    return {
      container: [
        '.sc-4d29e6fd-0 .action',
        '.sc-9565c853-0.action',
        '.sc-4d29e6fd-0 > a',
        '[data-testid="patch-note-card"]',
        'article',
      ],
      title: [
        '.sc-6fae0810-0',
        'span div',
        '.sc-d4b4173b-0',
        '[data-testid="patch-note-title"]',
        'h1',
        'h2',
        'h3',
      ],
      url: [
        '', // Use the element itself if it's an <a> tag
        'a[href*="patch"]',
        'a[href*="news"]',
        '[data-testid="patch-note-link"]',
        'a',
      ],
      image: ['.sc-d237f54f-0 img', 'img[src*="patch"]', '[data-testid="patch-note-image"]', 'img'],
    };
  }

  /**
   * 最新のパッチノートをスクレイピング
   */
  public async scrapeLatestPatch(): Promise<PatchNote | null> {
    let debugSessionId: string | undefined;

    try {
      Logger.info(`パッチノートスクレイピング開始: ${config.lol.patchNotesUrl}`);

      // デバッグセッション開始
      if (this.scraperDebugger) {
        debugSessionId = this.scraperDebugger.startSession('scrapeLatestPatch');
      }

      // メインページのHTML取得
      const response = await httpClient.get<string>(config.lol.patchNotesUrl);
      const $ = cheerio.load(response.data);

      // デバッグ: ページ構造のログ
      if (this.scraperDebugger) {
        this.scraperDebugger.logPageStructure($);
      }

      // パッチ要素の検索
      const patchElementResult = this.htmlParser.findElement($, this.selectors.container);
      if (!patchElementResult.element) {
        this.handleContainerNotFound();
      }

      const patchElement = patchElementResult.element;

      // デバッグ: パッチ要素のログ
      if (this.scraperDebugger) {
        this.scraperDebugger.logPatchElement($, patchElement as cheerio.Cheerio<Element>);
      }

      // パッチデータの抽出
      const patchData = this.extractPatchData($, patchElement);

      // 基本パッチノートオブジェクトの構築（詳細情報なし）
      const patchNote = this.buildBasicPatchNote(patchData);

      // 成功ログ
      this.logBasicScrapingSuccess(patchNote);

      // デバッグセッション終了
      if (this.scraperDebugger && debugSessionId) {
        this.scraperDebugger.endSession(debugSessionId);
      }

      return patchNote;
    } catch (error) {
      this.handleScrapingError(error, debugSessionId);
      throw error;
    }
  }

  /**
   * パッチデータを抽出
   */
  private extractPatchData(
    $: cheerio.CheerioAPI,
    patchElement: cheerio.Cheerio<AnyNode>
  ): ExtractedPatchData {
    // タイトル抽出
    const titleResult = this.htmlParser.extractTitle($, patchElement, this.selectors.title);
    if (!titleResult.success || !titleResult.value) {
      throw new ScrapingError('パッチノートのタイトルを抽出できませんでした');
    }

    // URL抽出
    const urlResult = this.htmlParser.extractUrl($, patchElement, this.selectors.url);
    if (!urlResult.success || !urlResult.value) {
      throw new ScrapingError('パッチノートのURLを抽出できませんでした');
    }

    // 画像URL抽出（オプショナル）
    const imageUrlResult = this.htmlParser.extractImageUrl($, patchElement, this.selectors.image);
    const imageUrl = imageUrlResult.success ? (imageUrlResult.value ?? null) : null;

    // バージョン番号抽出
    const version = this.htmlParser.extractVersion(titleResult.value);

    // URL正規化
    const normalizedUrl = this.htmlParser.normalizeUrl(urlResult.value);

    return {
      title: titleResult.value,
      url: urlResult.value,
      normalizedUrl,
      imageUrl,
      version,
    };
  }

  /**
   * 基本パッチノートオブジェクトを構築（詳細情報なし）
   */
  private buildBasicPatchNote(patchData: ExtractedPatchData): PatchNote {
    return {
      version: patchData.version,
      title: patchData.title,
      url: patchData.normalizedUrl,
      publishedAt: new Date(),
      // 基本情報のみ、詳細情報は後で追加
      ...(patchData.imageUrl && { imageUrl: patchData.imageUrl }),
    };
  }

  /**
   * 詳細ページから追加情報を取得
   */
  private async fetchDetailedPatchInfo(patchUrl: string): Promise<DetailedPatchInfo> {
    try {
      Logger.info(`詳細ページから情報取得中: ${patchUrl}`);

      const response = await httpClient.get<string>(patchUrl, {
        timeout: this.detailPageTimeout,
      });
      const $ = cheerio.load(response.data);

      // コンテンツと画像を並行して抽出
      const content = this.extractDetailedContent($);
      const imageUrl = this.extractDetailedImageUrl($);

      const result: DetailedPatchInfo = {};
      if (content) result.content = content;
      if (imageUrl) result.imageUrl = imageUrl;

      Logger.info(
        `詳細情報取得完了: ` +
          `コンテンツ=${content ? `${content.length}文字` : 'なし'}, ` +
          `画像=${imageUrl ?? 'なし'}`
      );

      return result;
    } catch (error) {
      Logger.error(`詳細ページの取得に失敗: ${patchUrl}`, error);
      return {};
    }
  }

  /**
   * 詳細ページからコンテンツを抽出
   */
  private extractDetailedContent($: cheerio.CheerioAPI): string | null {
    // コンテンツ抽出用のセレクタ
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.article-content',
      '.patch-content',
      '[data-testid="patch-content"]',
      '.content-wrapper',
      '.article-body',
      '.content',
    ];

    for (const selector of contentSelectors) {
      const contentElement = $(selector);
      if (contentElement.length > 0) {
        // HTMLタグを除去してテキストのみ取得
        let content = contentElement.text().trim();

        // 不要な改行や空白を整理
        content = content.replace(/\s+/g, ' ').replace(/\n+/g, '\n');

        // 十分な長さのコンテンツのみ採用（100文字以上）
        if (content && content.length > 100) {
          Logger.debug(`コンテンツ抽出成功 (${selector}): ${content.length}文字`);
          return content;
        }
      }
    }

    Logger.debug('詳細コンテンツが見つかりませんでした');
    return null;
  }

  /**
   * 詳細ページから高解像度画像URLを抽出
   */
  private extractDetailedImageUrl($: cheerio.CheerioAPI): string | null {
    // 高解像度画像検索パターン
    const imagePatterns = [
      { selector: 'img[src*="1920x1080"]', priority: 100 },
      { selector: 'img[src*="1600x"]', priority: 90 },
      { selector: 'img[src*="1920x"]', priority: 90 },
      { selector: '.hero-image img', priority: 80 },
      { selector: '.patch-hero img', priority: 80 },
      { selector: '.banner-image img', priority: 80 },
      { selector: '[data-testid="patch-hero-image"]', priority: 70 },
      { selector: 'article img[src*="patch"]', priority: 60 },
      { selector: 'main img[src*="splash"]', priority: 60 },
      { selector: '.content img[src*="banner"]', priority: 50 },
    ];

    // 優先度順にソート
    imagePatterns.sort((a, b) => b.priority - a.priority);

    // 画像を検索
    for (const pattern of imagePatterns) {
      const imgElements = $(pattern.selector);

      for (let i = 0; i < imgElements.length; i++) {
        const img = imgElements.eq(i);
        const src = img.attr('src') ?? img.attr('data-src');

        if (src && this.imageValidator.isValidImageUrl(src)) {
          Logger.debug(`高解像度画像発見 (${pattern.selector}): ${src}`);
          return src;
        }
      }
    }

    Logger.debug('詳細ページから画像URLが見つかりませんでした');
    return null;
  }

  /**
   * パッチノートオブジェクトを構築
   */
  private buildPatchNote(
    patchData: ExtractedPatchData,
    detailedInfo: DetailedPatchInfo
  ): PatchNote {
    // 画像URLの優先度: 詳細ページ > リストページ
    const finalImageUrl = detailedInfo.imageUrl ?? patchData.imageUrl;

    return {
      version: patchData.version,
      title: patchData.title,
      url: patchData.normalizedUrl,
      publishedAt: new Date(),
      ...(detailedInfo.content && { content: detailedInfo.content }),
      ...(finalImageUrl && { imageUrl: this.htmlParser.normalizeUrl(finalImageUrl) }),
    };
  }

  /**
   * コンテナが見つからない場合のエラーハンドリング
   */
  private handleContainerNotFound(): never {
    if (this.isDebugMode) {
      Logger.debug('試行したコンテナセレクタ:', this.selectors.container);
    }
    throw new ScrapingError('パッチノートコンテナが見つかりませんでした');
  }

  /**
   * スクレイピングエラーのハンドリング
   */
  private handleScrapingError(error: unknown, debugSessionId?: string): void {
    const message = 'パッチノートのスクレイピングに失敗しました';
    Logger.error(message, error);

    // デバッグセッションの終了
    if (this.scraperDebugger && debugSessionId) {
      try {
        const metrics = this.scraperDebugger.getSessionMetrics(debugSessionId);
        if (metrics) {
          Logger.error('デバッグセッションメトリクス:', metrics);
        }
        this.scraperDebugger.endSession(debugSessionId);
      } catch (debugError) {
        Logger.error('デバッグセッション終了エラー:', debugError);
      }
    }

    // 元のエラーを再スロー
    if (!(error instanceof ScrapingError)) {
      throw new ScrapingError(message);
    }
  }

  /**
   * 基本スクレイピング成功時のログ出力（詳細情報なし）
   */
  private logBasicScrapingSuccess(patchNote: PatchNote): void {
    const details = [patchNote.title, patchNote.imageUrl ? '(画像あり)' : '']
      .filter(Boolean)
      .join(' ');

    Logger.info(`基本パッチノート取得成功: ${details}`);
  }

  /**
   * 成功時のログ出力（詳細情報あり）
   */
  private logSuccessfulScraping(patchNote: PatchNote): void {
    const details = [
      patchNote.title,
      patchNote.content ? `(本文: ${patchNote.content.length}文字)` : '',
      patchNote.imageUrl ? '(画像あり)' : '',
    ]
      .filter(Boolean)
      .join(' ');

    Logger.info(`パッチノート取得成功: ${details}`);
  }

  /**
   * 詳細ページ情報を取得（後方互換性のため）
   * @deprecated scrapeDetailedPatchを使用してください
   */
  public scrapePatchDetails(patchUrl: string): Promise<DetailedPatchInfo> {
    return this.scrapeDetailedPatch(patchUrl);
  }

  /**
   * 詳細ページから情報を取得（後方互換性のため）
   */
  public scrapeDetailedPatch(patchUrl: string): Promise<DetailedPatchInfo> {
    return this.fetchDetailedPatchInfo(patchUrl);
  }
}
