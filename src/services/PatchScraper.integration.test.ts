/**
 * PatchScraper Integration Tests
 * PatchScraperの協調テスト - 他のサービスとの連携を検証
 */

import { PatchScraper } from './PatchScraper';
import { HtmlParser, type SelectorSet, type ParseResult } from './scrapers/HtmlParser';
import { ImageValidator } from './scrapers/ImageValidator';
import { ScraperDebugger } from './scrapers/ScraperDebugger';
import { httpClient } from '../utils/httpClient';
import { Logger } from '../utils/logger';
import type { HttpResponse } from '../types';
import * as cheerio from 'cheerio';

// モック設定
jest.mock('../utils/httpClient');
jest.mock('../utils/logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// 部分的なモック - 実際のサービスインスタンスを使用
jest.mock('./scrapers/HtmlParser');
jest.mock('./scrapers/ImageValidator');
jest.mock('./scrapers/ScraperDebugger');

describe('PatchScraper Integration Tests - サービス協調テスト', () => {
  let patchScraper: PatchScraper;
  let mockHttpClient: jest.Mocked<typeof httpClient>;
  let mockLogger: jest.Mocked<typeof Logger>;

  // テスト用HTMLデータ
  const mockPatchListHtml = `
    <html>
      <body>
        <div class="sc-4d29e6fd-0 grid-container">
          <a href="/ja-jp/news/game-updates/patch-14-1-notes" class="action">
            <div class="sc-6fae0810-0">パッチ14.1ノート</div>
            <img class="sc-d237f54f-0" src="https://example.com/patch-14-1-thumb.jpg" alt="パッチ14.1">
          </a>
          <a href="/ja-jp/news/game-updates/patch-14-2-notes" class="action">
            <div class="sc-6fae0810-0">パッチ14.2ノート</div>
            <img class="sc-d237f54f-0" src="https://example.com/patch-14-2-thumb.jpg" alt="パッチ14.2">
          </a>
        </div>
      </body>
    </html>
  `;

  const mockPatchDetailHtml = `
    <html>
      <body>
        <main>
          <h1>パッチ14.1ノート</h1>
          <article>
            <p>このパッチではチャンピオンのバランス調整を行いました。アーリは基本ダメージが増加し、
            ゼドは基本体力が減少しました。また、新しいアイテムが追加されています。</p>
            <img src="https://cmsassets.rgpub.io/patch-14-1-1920x1080.jpg" alt="パッチ14.1詳細">
          </article>
        </main>
      </body>
    </html>
  `;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttpClient = httpClient as jest.Mocked<typeof httpClient>;
    mockLogger = Logger as jest.Mocked<typeof Logger>;

    // PatchScraperインスタンスを作成（実際のコンストラクタを呼び出す）
    patchScraper = new PatchScraper();
  });

  describe('サービス統合テスト', () => {
    it('HtmlParser, ImageValidator, ScraperDebuggerが正しく初期化される', () => {
      expect(HtmlParser).toHaveBeenCalled();
      expect(ImageValidator).toHaveBeenCalled();
      expect(ScraperDebugger).toHaveBeenCalled();
    });

    it('最新パッチのスクレイピングで各サービスが協調動作する', async () => {
      // HTTPレスポンスのモック
      mockHttpClient.get.mockResolvedValue({
        data: mockPatchListHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as HttpResponse<string>);

      // HtmlParserのモック動作を設定
      const mockHtmlParser = HtmlParser.prototype as any;
      mockHtmlParser.parseHtml = jest.fn().mockImplementation((html: string) => {
        return cheerio.load(html);
      });
      mockHtmlParser.findElement = jest
        .fn()
        .mockImplementation(($: cheerio.CheerioAPI, selectors: string[]) => ({
          success: true,
          element: $('.sc-4d29e6fd-0 .action').first(),
          selectorUsed: '.sc-4d29e6fd-0 .action',
          attemptCount: 1,
          parseTime: 5,
        }));
      mockHtmlParser.extractVersion = jest.fn().mockReturnValue('14.1');
      mockHtmlParser.normalizeUrl = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith('/')) return `https://example.com${url}`;
        return url;
      });

      mockHtmlParser.extractTitle = jest.fn().mockImplementation(
        ($: cheerio.CheerioAPI, container: any) =>
          ({
            success: true,
            value: 'パッチ14.1ノート',
            selectorUsed: '.sc-6fae0810-0',
            attemptCount: 1,
            parseTime: 10,
          }) as ParseResult<string>
      );

      mockHtmlParser.extractUrl = jest.fn().mockImplementation(
        ($: cheerio.CheerioAPI, container: any) =>
          ({
            success: true,
            value: '/ja-jp/news/game-updates/patch-14-1-notes',
            selectorUsed: 'a',
            attemptCount: 1,
            parseTime: 5,
          }) as ParseResult<string>
      );

      mockHtmlParser.extractImageUrl = jest.fn().mockImplementation(
        () =>
          ({
            success: true,
            value: 'https://example.com/patch-14-1-thumb.jpg',
            selectorUsed: 'img',
            attemptCount: 1,
            parseTime: 8,
          }) as ParseResult<string>
      );

      // ImageValidatorのモック動作を設定
      const mockImageValidator = ImageValidator.prototype as any;
      mockImageValidator.isValidImageUrl = jest.fn().mockReturnValue(true);

      // 詳細ページのHTTPレスポンスモック
      mockHttpClient.get
        .mockImplementationOnce(() =>
          Promise.resolve({
            data: mockPatchListHtml,
            status: 200,
            statusText: 'OK',
            headers: {},
          } as HttpResponse<string>)
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            data: mockPatchDetailHtml,
            status: 200,
            statusText: 'OK',
            headers: {},
          } as HttpResponse<string>)
        );

      // 実行
      const patch = await patchScraper.scrapeLatestPatch();

      // 検証 - 各サービスが適切に呼び出されたか
      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.any(String));
      expect(mockHtmlParser.parseHtml).toHaveBeenCalled();
      expect(mockHtmlParser.extractTitle).toHaveBeenCalled();
      expect(mockHtmlParser.extractUrl).toHaveBeenCalled();
      expect(mockHtmlParser.extractImageUrl).toHaveBeenCalled();
      expect(mockImageValidator.isValidImageUrl).toHaveBeenCalled();

      // 結果の検証
      expect(patch).not.toBeNull();
      expect(patch).toMatchObject({
        title: 'パッチ14.1ノート',
        url: expect.stringContaining('patch-14-1-notes'),
        version: '14.1',
      });
    });

    it('パッチ詳細ページの取得で各サービスが協調動作する', async () => {
      // HTTPレスポンスのモック
      mockHttpClient.get.mockResolvedValue({
        data: mockPatchDetailHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as HttpResponse<string>);

      // ImageValidatorのモック動作を設定
      const mockImageValidator = ImageValidator.prototype as any;
      mockImageValidator.isValidImageUrl = jest.fn().mockImplementation((url: string) => {
        return url.startsWith('https://') && (url.endsWith('.jpg') || url.endsWith('.png'));
      });

      // 実行
      const details = await patchScraper.scrapeDetailedPatch(
        'https://example.com/patch-14-1-notes'
      );

      // 検証
      expect(mockHttpClient.get).toHaveBeenCalledWith('https://example.com/patch-14-1-notes');
      expect(mockImageValidator.isValidImageUrl).toHaveBeenCalledWith(
        expect.stringContaining('1920x1080')
      );

      // 結果の検証
      expect(details).toMatchObject({
        content: expect.stringContaining('チャンピオンのバランス調整'),
        imageUrl: 'https://cmsassets.rgpub.io/patch-14-1-1920x1080.jpg',
      });
    });

    it('デバッグモードで詳細なログが出力される', async () => {
      // デバッグモードを有効化
      process.env.SCRAPER_DEBUG = 'true';
      const debugPatchScraper = new PatchScraper();

      // ScraperDebuggerのモック動作を設定
      const mockScraperDebugger = ScraperDebugger.prototype as any;
      mockScraperDebugger.logPageStructure = jest.fn();
      mockScraperDebugger.logPatchElement = jest.fn();
      mockScraperDebugger.logContainerImages = jest.fn();

      // HTTPレスポンスのモック
      mockHttpClient.get.mockResolvedValue({
        data: mockPatchListHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as HttpResponse<string>);

      // HtmlParserのモック
      const mockHtmlParser = HtmlParser.prototype as any;
      mockHtmlParser.parseHtml = jest.fn().mockImplementation((html: string) => {
        return cheerio.load(html);
      });
      mockHtmlParser.findElement = jest.fn().mockImplementation(() => ({
        success: false,
        element: null,
      }));

      // 実行
      try {
        await debugPatchScraper.scrapeLatestPatch();
      } catch (error) {
        // エラーを期待（要素が見つからないため）
      }

      // デバッグログが出力されたか検証
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting patch notes scraping')
      );
      expect(mockScraperDebugger.logPageStructure).toHaveBeenCalled();

      // クリーンアップ
      delete process.env.SCRAPER_DEBUG;
    });

    it('エラーハンドリングが適切に機能する', async () => {
      // HTTPエラーのモック
      mockHttpClient.get.mockRejectedValue(new Error('Network error'));

      // 実行
      const result = await patchScraper.scrapeLatestPatch().catch(() => null);

      // エラーログが出力されたか検証
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to scrape patch notes'),
        expect.any(Error)
      );

      // nullが返されることを確認
      expect(result).toBeNull();
    });

    it('画像URLの検証で無効な画像が除外される', async () => {
      // HTTPレスポンスのモック（無効な画像URLを含む）
      const htmlWithInvalidImages = `
        <html>
          <body>
            <div class="sc-4d29e6fd-0">
              <a href="/patch-14-1" class="action">
                <div class="sc-6fae0810-0">パッチ14.1</div>
                <img src="invalid-image" alt="パッチ14.1">
              </a>
            </div>
          </body>
        </html>
      `;

      // 最初のリクエスト（パッチ一覧）
      mockHttpClient.get.mockImplementationOnce(() =>
        Promise.resolve({
          data: htmlWithInvalidImages,
          status: 200,
          statusText: 'OK',
          headers: {},
        } as HttpResponse<string>)
      );

      // 詳細ページのリクエスト（imageUrl無し）
      mockHttpClient.get.mockImplementationOnce(() =>
        Promise.resolve({
          data: '<html><body><main><article>Content</article></main></body></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
        } as HttpResponse<string>)
      );

      // HtmlParserのモック
      const mockHtmlParser = HtmlParser.prototype as any;
      mockHtmlParser.parseHtml = jest.fn().mockImplementation((html: string) => {
        return cheerio.load(html);
      });
      mockHtmlParser.findElement = jest.fn().mockReturnValue({
        success: true,
        element: cheerio.load(htmlWithInvalidImages)('.action').first(),
      });
      mockHtmlParser.extractTitle = jest.fn().mockReturnValue({
        success: true,
        value: 'パッチ14.1',
      });
      mockHtmlParser.extractUrl = jest.fn().mockReturnValue({
        success: true,
        value: '/patch-14-1',
      });
      mockHtmlParser.extractVersion = jest.fn().mockReturnValue('14.1');
      mockHtmlParser.normalizeUrl = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith('/')) return `https://example.com${url}`;
        return url;
      });

      mockHtmlParser.extractImageUrl = jest.fn().mockImplementation(
        () =>
          ({
            success: false,
            attemptCount: 1,
            parseTime: 5,
          }) as unknown as ParseResult<string>
      );

      // ImageValidatorのモック - 無効な画像として判定
      const mockImageValidator = ImageValidator.prototype as any;
      mockImageValidator.isValidImageUrl = jest.fn().mockReturnValue(false);

      // 実行
      const patch = await patchScraper.scrapeLatestPatch();

      // 画像URLが除外されていることを確認
      expect(patch).not.toBeNull();
      expect(patch?.imageUrl).toBeUndefined();
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量のパッチ要素を効率的に処理できる', async () => {
      // 大量のパッチ要素を含むHTML
      const largePatchListHtml = `
        <html>
          <body>
            <div class="sc-4d29e6fd-0">
              ${Array.from(
                { length: 50 },
                (_, i) => `
                <a href="/patch-${i}" class="action">
                  <div class="sc-6fae0810-0">パッチ${i}</div>
                  <img src="https://example.com/patch-${i}.jpg" alt="パッチ${i}">
                </a>
              `
              ).join('')}
            </div>
          </body>
        </html>
      `;

      mockHttpClient.get.mockResolvedValue({
        data: largePatchListHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as HttpResponse<string>);

      // HtmlParserのモック
      const mockHtmlParser = HtmlParser.prototype as any;
      mockHtmlParser.parseHtml = jest.fn().mockImplementation((html: string) => {
        return cheerio.load(html);
      });
      mockHtmlParser.findElement = jest.fn().mockReturnValue({
        success: true,
        element: cheerio.load(largePatchListHtml)('.action').first(),
      });
      mockHtmlParser.extractTitle = jest.fn().mockReturnValue({
        success: true,
        value: 'パッチタイトル',
      });
      mockHtmlParser.extractUrl = jest.fn().mockReturnValue({
        success: true,
        value: '/patch-url',
      });
      mockHtmlParser.extractImageUrl = jest.fn().mockReturnValue({
        success: true,
        value: 'https://example.com/patch.jpg',
      });
      mockHtmlParser.extractVersion = jest.fn().mockReturnValue('1.0');
      mockHtmlParser.normalizeUrl = jest.fn().mockImplementation((url: string) => url);

      // ImageValidatorのモック
      const mockImageValidator = ImageValidator.prototype as any;
      mockImageValidator.isValidImageUrl = jest.fn().mockReturnValue(true);

      const startTime = performance.now();
      const patch = await patchScraper.scrapeLatestPatch();
      const endTime = performance.now();

      // 検証
      expect(patch).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内に処理完了
    });
  });
});
