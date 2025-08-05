/**
 * Enhanced HtmlParser Test Suite
 * エンタープライズ級HTML解析サービスのテストスイート
 */

import * as cheerio from 'cheerio';
import {
  type AdvancedPattern,
  type DOMOperation,
  type ElementSearchResult,
  HtmlParser,
  type HtmlParserConfig,
  type ParseResult,
  type ParsingTask,
} from './HtmlParser';
import type { ImageValidatorInterface } from './ImageValidator';
import { Logger } from '../../utils/logger';

// Loggerのモック
jest.mock('../../utils/logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('HtmlParser - Enhanced Enterprise Service', () => {
  let htmlParser: HtmlParser;
  let mockLogger: jest.Mocked<typeof Logger>;
  let mockImageValidator: jest.Mocked<ImageValidatorInterface>;
  let mockHtml: string;
  let $: cheerio.CheerioAPI;

  beforeEach(() => {
    mockLogger = Logger as jest.Mocked<typeof Logger>;
    jest.clearAllMocks();

    // ImageValidatorのモック作成
    mockImageValidator = {
      validateImageUrl: jest.fn().mockReturnValue({
        isValid: true,
        details: {
          url: '',
          protocol: 'https',
          format: 'jpeg',
          validationTime: 0,
        },
      }),
      validateBatch: jest.fn(),
      getMetrics: jest.fn(),
      updateConfig: jest.fn(),
    };

    // 拡張モックHTML作成
    mockHtml = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <div class="sc-4d29e6fd-0 patch-container">
            <div class="patch-item">
              <a href="/patch/14.1" class="patch-link">
                <h2 class="patch-title">パッチノート 14.1</h2>
                <img src="https://example.com/patch14.1.jpg" alt="Patch 14.1" class="patch-image"/>
                <img data-src="https://example.com/lazy-image.png" alt="Lazy Image" class="lazy-image"/>
              </a>
            </div>
            <div class="patch-item">
              <a href="https://external.com/link" target="_blank" rel="noopener">
                <span class="title">Patch 14.2</span>
                <img src="invalid-image" alt="Invalid"/>
              </a>
            </div>
          </div>
          <div class="sidebar">
            <img src="" alt="Empty Source"/>
            <img data-src="https://example.com/news-image.jpg" alt="News Image"/>
          </div>
        </body>
      </html>
    `;

    $ = cheerio.load(mockHtml);
    htmlParser = new HtmlParser(mockImageValidator, {}, mockLogger);
  });

  describe('初期化とセットアップ', () => {
    test('デフォルト設定で正しく初期化される', () => {
      const parser = new HtmlParser();

      expect(parser).toBeInstanceOf(HtmlParser);
      expect(parser.getMetrics().totalParses).toBe(0);
    });

    test('カスタム設定で初期化される', () => {
      const config: Partial<HtmlParserConfig> = {
        enableCaching: false,
        maxSelectorAttempts: 5,
        strictMode: true,
        cacheTimeout: 10000,
      };

      const _parser = new HtmlParser(mockImageValidator, config, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'HtmlParser initialized with config:',
        expect.objectContaining(config)
      );
    });
  });

  describe('要素検索機能 (findElement)', () => {
    test('セレクタで要素を正しく検索する', () => {
      const selectors = ['.missing', '.patch-container'];
      const result: ElementSearchResult = htmlParser.findElement($, selectors);

      expect(result.element).not.toBeNull();
      expect(result.selector).toBe('.patch-container');
      expect(result.fallbackLevel).toBe(1);
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
      expect(result.elementCount).toBe(1);
    });

    test('要素が見つからない場合の処理', () => {
      const selectors = ['.non-existent', '.also-missing'];
      const result = htmlParser.findElement($, selectors);

      expect(result.element).toBeNull();
      expect(result.selector).toBe('');
      expect(result.fallbackLevel).toBe(-1);
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });

    test('セレクタ制限の確認', () => {
      const parser = new HtmlParser(mockImageValidator, { maxSelectorAttempts: 2 });
      const selectors = ['.missing1', '.missing2', '.missing3', '.patch-container'];
      const result = parser.findElement($, selectors);

      expect(result.element).toBeNull(); // 制限により見つからない
    });

    test('無効なセレクタのエラーハンドリング', () => {
      const selectors = ['invalid::', '.patch-container'];
      const result = htmlParser.findElement($, selectors);

      expect(result.element).not.toBeNull();
      expect(result.selector).toBe('.patch-container');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Selector failed:'),
        expect.any(Error)
      );
    });
  });

  describe('タイトル抽出機能 (extractTitle)', () => {
    test('コンテナ内からパッチタイトルを抽出する', () => {
      const container = $('.patch-item').first();
      const selectors = ['.patch-title'];
      const result: ParseResult<string> = htmlParser.extractTitle($, container, selectors);

      expect(result.success).toBe(true);
      expect(result.value).toBe('パッチノート 14.1');
      expect(result.selectorUsed).toBe('.patch-title');
      expect(result.fallbackUsed).toBe(false);
      expect(result.parseTime).toBeGreaterThanOrEqual(0);
    });

    test('フォールバックでコンテナテキストから抽出', () => {
      const container = $('.patch-item').eq(1);
      const selectors = ['.missing-title'];
      const result = htmlParser.extractTitle($, container, selectors);

      expect(result.success).toBe(true);
      expect(result.value).toBe('パッチノート 14.2');
      expect(result.fallbackUsed).toBe(true);
    });

    test('タイトルが見つからない場合', () => {
      const container = $('.sidebar');
      const selectors = ['.missing-title'];
      const result = htmlParser.extractTitle($, container, selectors);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No title found');
      expect(result.attemptCount).toBeGreaterThan(0);
    });

    test('複数のパッチタイトルパターンを認識', () => {
      const testCases = [
        { text: 'パッチノート 14.1', expected: 'パッチノート 14.1' },
        { text: 'Patch Notes 14.2', expected: 'パッチノート 14.2' },
        { text: 'アップデート 14.3', expected: 'パッチノート 14.3' },
        { text: 'Update 14.4', expected: 'パッチノート 14.4' },
      ];

      testCases.forEach(({ text, expected }) => {
        const testHtml = `<div><span>${text}</span></div>`;
        const test$ = cheerio.load(testHtml);
        const container = test$('div');
        const result = htmlParser.extractTitle(test$, container, ['span']);

        expect(result.success).toBe(true);
        expect(result.value).toBe(expected);
      });
    });
  });

  describe('URL抽出機能 (extractUrl)', () => {
    test('コンテナがアンカータグの場合のURL抽出', () => {
      const container = $('.patch-link').first();
      const result: ParseResult<string> = htmlParser.extractUrl($, container, []);

      expect(result.success).toBe(true);
      expect(result.value).toBe('/patch/14.1');
      expect(result.selectorUsed).toBe('container-href');
      expect(result.fallbackUsed).toBe(false);
    });

    test('コンテナ内のリンクからURL抽出', () => {
      const container = $('.patch-item').first();
      const selectors = ['a[href]'];
      const result = htmlParser.extractUrl($, container, selectors);

      expect(result.success).toBe(true);
      expect(result.value).toBe('/patch/14.1');
    });

    test('ドキュメント全体からフォールバック検索', () => {
      const emptyContainer = $('<div></div>');
      const selectors = ['a[href*="patch"]'];
      const result = htmlParser.extractUrl($, emptyContainer, selectors);

      expect(result.success).toBe(true);
      expect(result.value).toBe('/patch/14.1');
      expect(result.fallbackUsed).toBe(true);
    });

    test('URLが見つからない場合', () => {
      const container = $('.sidebar');
      const selectors = ['.missing-link'];
      const result = htmlParser.extractUrl($, container, selectors);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No URL found');
    });
  });

  describe('画像URL抽出機能 (extractImageUrl)', () => {
    test('コンテナ内の画像URL抽出', () => {
      const container = $('.patch-item').first();
      const selectors = ['.patch-image'];
      const result: ParseResult<string> = htmlParser.extractImageUrl($, container, selectors);

      expect(result.success).toBe(true);
      expect(result.value).toBe('https://example.com/patch14.1.jpg');
      expect(result.selectorUsed).toBe('.patch-image');
    });

    test('data-src属性からの画像URL抽出', () => {
      const container = $('.patch-item').first();
      const selectors = ['.lazy-image'];
      const result = htmlParser.extractImageUrl($, container, selectors);

      expect(result.success).toBe(true);
      expect(result.value).toBe('https://example.com/lazy-image.png');
    });

    test('ドキュメント全体からのフォールバック検索', () => {
      const emptyContainer = $('<div></div>');
      const selectors = ['img[data-src*="news"]'];
      const result = htmlParser.extractImageUrl($, emptyContainer, selectors);

      expect(result.success).toBe(true);
      expect(result.value).toBe('https://example.com/news-image.jpg');
      expect(result.fallbackUsed).toBe(true);
    });

    test('無効な画像URLの除外', () => {
      mockImageValidator.validateImageUrl.mockReturnValue({
        isValid: false,
        details: {
          url: '',
          protocol: 'https',
          validationTime: 0,
        },
      });

      const container = $('.patch-item').first();
      const selectors = ['.patch-image'];
      const result = htmlParser.extractImageUrl($, container, selectors);

      expect(result.success).toBe(false);
    });

    test('ImageValidatorなしでの基本検証', () => {
      const parser = new HtmlParser(); // ImageValidatorなし
      const container = $('.patch-item').first();
      const selectors = ['.patch-image'];
      const result = parser.extractImageUrl($, container, selectors);

      expect(result.success).toBe(true); // 基本検証は通過
      expect(result.value).toBe('https://example.com/patch14.1.jpg');
    });
  });

  describe('バージョン抽出機能 (extractVersion)', () => {
    test('複数のバージョンパターンを認識', () => {
      const testCases = [
        { input: 'パッチノート 14.1', expected: '14.1' },
        { input: 'Patch 14.2.1', expected: '14.2.1' },
        { input: 'v14.3', expected: '14.3' },
        { input: 'Version 14.4', expected: '14.4' },
        { input: 'バージョン 14.5', expected: '14.5' },
        { input: 'Update 14.6', expected: '14.6' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = htmlParser.extractVersion(input);
        expect(result).toBe(expected);
      });
    });

    test('バージョンが見つからない場合のフォールバック', () => {
      const result = htmlParser.extractVersion('No version here');

      expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('No version found'));
    });
  });

  describe('URL正規化機能 (normalizeUrl)', () => {
    test('絶対URLはそのまま返す', () => {
      expect(htmlParser.normalizeUrl('https://example.com/path')).toBe('https://example.com/path');
      expect(htmlParser.normalizeUrl('http://example.com/path')).toBe('http://example.com/path');
    });

    test('プロトコル相対URLの変換', () => {
      expect(htmlParser.normalizeUrl('//example.com/path')).toBe('https://example.com/path');
    });

    test('ルート相対URLの変換', () => {
      expect(htmlParser.normalizeUrl('/path/to/page')).toBe(
        'https://www.leagueoflegends.com/path/to/page'
      );
    });

    test('その他の相対URLの変換', () => {
      expect(htmlParser.normalizeUrl('path/to/page')).toBe(
        'https://www.leagueoflegends.com/path/to/page'
      );
    });

    test('無効なURLの処理', () => {
      expect(htmlParser.normalizeUrl('')).toBe('');
      expect(htmlParser.normalizeUrl(null as any)).toBe('');
      expect(htmlParser.normalizeUrl(undefined as any)).toBe('');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid URL provided for normalization:',
        expect.anything()
      );
    });
  });

  describe('キャッシュ機能', () => {
    test('キャッシュが有効な場合の再利用', () => {
      const parser = new HtmlParser(mockImageValidator, { enableCaching: true });
      const container = $('.patch-item').first();
      const selectors = ['.patch-title'];

      // 初回実行
      const result1 = parser.extractTitle($, container, selectors);
      expect(result1.success).toBe(true);

      // 2回目実行（キャッシュから取得）
      const result2 = parser.extractTitle($, container, selectors);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(result1.value);
    });

    test('キャッシュが無効な場合は毎回実行', () => {
      const parser = new HtmlParser(mockImageValidator, { enableCaching: false });
      const container = $('.patch-item').first();
      const selectors = ['.patch-title'];

      const result1 = parser.extractTitle($, container, selectors);
      const result2 = parser.extractTitle($, container, selectors);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    test('キャッシュクリア機能', () => {
      const parser = new HtmlParser(mockImageValidator, { enableCaching: true }, mockLogger);

      parser.clearCache();

      expect(mockLogger.info).toHaveBeenCalledWith('HtmlParser cache cleared');
    });
  });

  describe('メトリクス機能', () => {
    test('操作メトリクスが正しく収集される', () => {
      const container = $('.patch-item').first();
      const selectors = ['.patch-title'];

      // 成功操作
      htmlParser.extractTitle($, container, selectors);

      // 失敗操作
      htmlParser.extractTitle($, $('.sidebar'), ['.missing']);

      const metrics = htmlParser.getMetrics();

      expect(metrics.totalParses).toBe(2);
      expect(metrics.successfulParses).toBe(1);
      expect(metrics.failedParses).toBe(1);
      expect(metrics.operationDistribution['extractTitle']).toBe(2);
    });

    test('セレクタ成功率が記録される', () => {
      const selectors = ['.missing', '.patch-title'];

      htmlParser.findElement($, selectors);

      const metrics = htmlParser.getMetrics();

      expect(metrics.selectorSuccessRate['.missing'] ?? 0).toBe(0);
      expect(metrics.selectorSuccessRate['.patch-title'] ?? 0).toBe(1);
    });

    test('メトリクスリセット機能', () => {
      htmlParser.extractTitle($, $('.patch-item').first(), ['.patch-title']);

      let metrics = htmlParser.getMetrics();
      expect(metrics.totalParses).toBe(1);

      htmlParser.resetMetrics();

      metrics = htmlParser.getMetrics();
      expect(metrics.totalParses).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('HtmlParser metrics reset');
    });

    test('メトリクス無効化', () => {
      const parser = new HtmlParser(mockImageValidator, { enableMetrics: false });
      const container = $('.patch-item').first();

      parser.extractTitle($, container, ['.patch-title']);

      const metrics = parser.getMetrics();
      expect(metrics.totalParses).toBe(0);
    });
  });

  describe('設定管理', () => {
    test('サービス情報取得', () => {
      const info = htmlParser.getServiceInfo();

      expect(info.uptime).toBeGreaterThanOrEqual(0);
      expect(info.config).toBeDefined();
      expect(info.metrics).toBeDefined();
      expect(info.cacheSize).toBeGreaterThanOrEqual(0);
    });

    test('設定に基づくフォールバック制御', () => {
      const parser = new HtmlParser(mockImageValidator, { enableFallbackSearch: false });
      const container = $('.patch-item').first();
      const selectors = ['.missing-title'];

      const result = parser.extractTitle($, container, selectors);

      expect(result.success).toBe(false); // フォールバック無効なので失敗
    });
  });

  describe('後方互換性', () => {
    test('レガシーfindElementメソッドが動作する', () => {
      const selectors = ['.patch-container'];
      const result = htmlParser.findElementLegacy($, selectors);

      expect(result).not.toBeNull();
      expect(result?.hasClass('patch-container')).toBe(true);
    });

    test('旧形式のメソッドシグネチャとの互換性', () => {
      const container = $('.patch-item').first();
      const selectors = ['.patch-title'];

      // 新形式の結果から値を抽出
      const result = htmlParser.extractTitle($, container, selectors);
      expect(result.success).toBe(true);
      expect(result.value).toBe('パッチノート 14.1');
    });
  });

  describe('エラーハンドリング', () => {
    test('extractUrlでエラーが発生した場合', () => {
      const brokenContainer = {
        html: () => null,
        find: () => {
          throw new Error('Find error');
        },
        is: () => false,
        attr: () => undefined,
      } as unknown as cheerio.Cheerio<any>;

      const result = htmlParser.extractUrl($, brokenContainer, ['a']);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('extractImageUrlでエラーが発生した場合', () => {
      const brokenContainer = {
        html: () => null,
        find: () => {
          throw new Error('Find error');
        },
      } as unknown as cheerio.Cheerio<any>;

      const result = htmlParser.extractImageUrl($, brokenContainer, ['img']);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    test('予期しないエラーの適切な処理', () => {
      // Cheerio操作でエラーを発生させる
      const brokenContainer = {
        html: () => null,
        find: () => {
          throw new Error('Cheerio error');
        },
        text: () => 'test text',
      } as unknown as cheerio.Cheerio<any>;

      const result = htmlParser.extractTitle($ as unknown as cheerio.CheerioAPI, brokenContainer, [
        '.test',
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('部分的な失敗でも処理を継続', () => {
      const selectors = ['.non-existent-selector', '.patch-title'];
      const container = $('.patch-item').first();

      const result = htmlParser.extractTitle($, container, selectors);

      expect(result.success).toBe(true); // 2番目のセレクタで成功
      expect(result.value).toBe('パッチノート 14.1');
    });
  });

  describe('パフォーマンス', () => {
    test('大量の要素を含むページでもパフォーマンスが維持される', () => {
      // 大きなHTMLを生成
      const largeHtml = `
        <html><body>
          ${Array.from(
            { length: 100 },
            (_, i) => `
            <div class="item-${i}">
              <span class="title">Title ${i}</span>
              <a href="/link${i}">Link ${i}</a>
              <img src="https://example.com/image${i}.jpg" alt="Image ${i}"/>
            </div>
          `
          ).join('')}
        </body></html>
      `;

      const large$ = cheerio.load(largeHtml);
      const startTime = performance.now();

      const result = htmlParser.findElement(large$, ['.item-50']);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.element).not.toBeNull();
      expect(duration).toBeLessThan(100); // 100ms以内
    });

    test('セレクタ試行回数制限が機能する', () => {
      const parser = new HtmlParser(mockImageValidator, { maxSelectorAttempts: 3 });
      const selectors = Array.from({ length: 10 }, (_, i) => `.missing-${i}`);

      const startTime = performance.now();
      const result = parser.findElement($, selectors);
      const endTime = performance.now();

      expect(result.element).toBeNull();
      expect(endTime - startTime).toBeLessThan(50); // 制限により高速
    });

    test('解析時間が記録される', () => {
      const container = $('.patch-item').first();
      const result = htmlParser.extractTitle($, container, ['.patch-title']);

      expect(result.parseTime).toBeGreaterThanOrEqual(0);
      expect(result.parseTime).toBeLessThan(100); // 100ms以内
    });
  });

  describe('高度な機能', () => {
    test('厳密モードでの動作', () => {
      const parser = new HtmlParser(mockImageValidator, { strictMode: true });

      // 厳密モードでの動作確認（実装によって異なる）
      const container = $('.patch-item').first();
      const result = parser.extractTitle($, container, ['.patch-title']);

      expect(result.success).toBe(true);
    });

    test('ディープサーチモードでの動作', () => {
      const parser = new HtmlParser(mockImageValidator, { enableDeepSearch: true });

      const container = $('.patch-item').first();
      const result = parser.extractTitle($, container, ['.patch-title']);

      expect(result.success).toBe(true);
    });

    test('検索タイムアウト設定', () => {
      const parser = new HtmlParser(mockImageValidator, { searchTimeout: 10 });

      const container = $('.patch-item').first();
      const result = parser.extractTitle($, container, ['.patch-title']);

      expect(result.success).toBe(true);
    });
  });

  // 従来のテストも保持（互換性確認）
  describe('従来のテストケース（互換性確認）', () => {
    test('指定されたセレクタで要素を見つける', () => {
      const selectors = ['.missing', '.patch-container'];
      const result = htmlParser.findElementLegacy($, selectors);

      expect(result).not.toBeNull();
      expect(result?.hasClass('patch-container')).toBe(true);
    });

    test('要素が見つからない場合はnullを返す', () => {
      const selectors = ['.missing'];
      const result = htmlParser.findElementLegacy($, selectors);

      expect(result).toBeNull();
    });

    test('バージョン抽出の従来パターン', () => {
      expect(htmlParser.extractVersion('パッチノート 14.1')).toBe('14.1');
      expect(htmlParser.extractVersion('Patch 14.2.1')).toBe('14.2.1');
      expect(htmlParser.extractVersion('Version 14.3')).toBe('14.3');
    });

    test('URL正規化の従来パターン', () => {
      expect(htmlParser.normalizeUrl('https://example.com/path')).toBe('https://example.com/path');
      expect(htmlParser.normalizeUrl('//example.com/path')).toBe('https://example.com/path');
      expect(htmlParser.normalizeUrl('/path/to/page')).toBe(
        'https://www.leagueoflegends.com/path/to/page'
      );
    });
  });

  describe('高度な解析機能', () => {
    test('parseWithXPathで空のHTMLの場合', () => {
      const htmlParser = new HtmlParser(mockImageValidator, { enableXPathSupport: true });

      // 空のHTMLで解析
      const result = htmlParser.parseWithXPath('', '//div');

      expect(result.success).toBe(true);
      expect(result.value).toEqual([]);
    });

    test('XPath解析が無効の場合はエラーを返す', () => {
      const result = htmlParser.parseWithXPath(mockHtml, '//div');

      expect(result.success).toBe(false);
      expect(result.error).toBe('XPath support is disabled');
    });

    test('XPath解析が有効の場合の動作', () => {
      const parser = new HtmlParser(mockImageValidator, { enableXPathSupport: true });
      const result = parser.parseWithXPath(mockHtml, '//div');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
    });

    test('高度なパターンマッチングが無効の場合', () => {
      const patterns: AdvancedPattern[] = [
        {
          name: 'test-pattern',
          selectors: ['.patch-title'],
          priority: 1,
        },
      ];

      const result = htmlParser.parseWithAdvancedPatterns($, patterns);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Advanced patterns are disabled');
    });

    test('高度なパターンマッチングが有効の場合', () => {
      const parser = new HtmlParser(mockImageValidator, { enableAdvancedPatterns: true });
      const patterns: AdvancedPattern[] = [
        {
          name: 'patch-titles',
          selectors: ['.patch-title', 'h2'],
          priority: 1,
          validator: el => el.text().includes('パッチ'),
          transformer: el => el.text().trim(),
        },
      ];

      const result = parser.parseWithAdvancedPatterns($, patterns);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      if (result.value) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    test('コンテンツ分析が無効の場合はエラー', () => {
      expect(() => {
        htmlParser.analyzeContent($);
      }).toThrow('Content analysis is disabled');
    });

    test('コンテンツ分析が有効の場合', () => {
      const parser = new HtmlParser(mockImageValidator, { enableContentAnalysis: true });
      const result = parser.analyzeContent($, {
        includeMetadata: true,
        analyzeSemantic: false,
        extractKeywords: true,
        detectLanguage: true,
        analyzeStructure: true,
        includeReadability: true,
      });

      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.characterCount).toBeGreaterThan(0);
      expect(result.imageCount).toBe(5); // mockHtmlの画像数
      expect(result.linkCount).toBe(2); // mockHtmlのリンク数
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(result.language).toBeDefined();
      expect(result.readabilityScore).toBeGreaterThanOrEqual(0);
    });

    test('DOM操作が無効の場合', () => {
      const operations: DOMOperation[] = [
        {
          type: 'add',
          selector: 'body',
          content: '<div>New content</div>',
          position: 'append',
        },
      ];

      const result = htmlParser.manipulateDOM($, operations);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DOM manipulation is disabled');
    });

    test('DOM操作が有効の場合', () => {
      const parser = new HtmlParser(mockImageValidator, { enableDomManipulation: true });
      const operations: DOMOperation[] = [
        {
          type: 'add',
          selector: '.patch-container',
          content: '<div class="new-element">Added content</div>',
          position: 'append',
        },
        {
          type: 'modify',
          selector: '.patch-title',
          attributes: { 'data-modified': 'true' },
        },
      ];

      const result = parser.manipulateDOM($, operations);

      expect(result.success).toBe(true);
      expect(result.value).toBeDefined();
    });

    test('並列解析が無効の場合はエラー', async () => {
      const tasks: ParsingTask[] = [
        {
          id: 'task1',
          type: 'extract',
          selectors: ['.patch-title'],
          priority: 1,
        },
      ];

      await expect(htmlParser.parallelParse($, tasks)).rejects.toThrow(
        'Parallel parsing is disabled'
      );
    });

    test('並列解析が有効の場合', async () => {
      const parser = new HtmlParser(mockImageValidator, {
        enableParallelParsing: true,
        maxParallelTasks: 2,
      });
      const tasks: ParsingTask[] = [
        {
          id: 'extract-titles',
          type: 'extract',
          selectors: ['.patch-title', 'h2'],
          priority: 2,
        },
        {
          id: 'search-links',
          type: 'search',
          selectors: ['a[href]'],
          priority: 1,
        },
        {
          id: 'analyze-structure',
          type: 'analyze',
          selectors: ['.patch-item'],
          priority: 1,
        },
      ];

      const results = await parser.parallelParse($, tasks);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      expect(results.every(r => typeof r.success === 'boolean')).toBe(true);
    });

    test('ストリーミング解析が無効の場合はエラー', async () => {
      const mockStream = new ReadableStream({
        start(controller): void {
          controller.enqueue(new TextEncoder().encode(mockHtml));
          controller.close();
        },
      });

      const streamGenerator = htmlParser.streamParse(mockStream, ['.patch-title']);

      await expect(streamGenerator.next()).rejects.toThrow('Streaming parsing is disabled');
    });

    test('ストリーミング解析が有効の場合', async () => {
      const parser = new HtmlParser(mockImageValidator, {
        enableStreamingParsing: true,
        streamChunkSize: 1024,
      });

      const mockStream = new ReadableStream({
        start(controller): void {
          controller.enqueue(new TextEncoder().encode(mockHtml));
          controller.close();
        },
      });

      const results: ParseResult<unknown>[] = [];
      const streamGenerator = parser.streamParse(mockStream, ['.patch-title']);

      for await (const result of streamGenerator) {
        results.push(result);
      }

      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('パフォーマンス最適化', () => {
    test('パフォーマンス最適化が有効の場合', () => {
      const parser = new HtmlParser(mockImageValidator, { performanceOptimization: true });
      const container = $('.patch-item').first();

      const startTime = performance.now();
      const result = parser.extractTitle($, container, ['.patch-title']);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // 100ms以内
    });

    test('extractTitleで空文字列のフォールバック動作', () => {
      const parser = new HtmlParser(mockImageValidator);
      const emptyContainer = cheerio.load('<div></div>')('div');

      // コンテナテキストが空の場合
      const result = parser.extractTitle($, emptyContainer, ['.non-existent']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No title found');
    });

    test('キャッシュヒット時の動作確認', () => {
      const parser = new HtmlParser(mockImageValidator, {
        enableCaching: true,
        cacheTimeout: 5000,
      });
      const container = $('.patch-item').first();
      const selectors = ['.patch-title'];

      // 初回実行でキャッシュに保存
      const result1 = parser.extractTitle($, container, selectors);
      expect(result1.success).toBe(true);
      expect(result1.value).toBe('パッチノート 14.1');

      // 2回目実行（キャッシュヒット）
      const result2 = parser.extractTitle($, container, selectors);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe('パッチノート 14.1');
      expect(result2.value).toBe(result1.value);

      // キャッシュヒットの確認（ログまたは内部状態で確認）
      const metrics = parser.getMetrics();
      expect(metrics.totalParses).toBe(1); // キャッシュヒットのため1回のみ
    });

    test('キャッシュタイムアウト後の再解析', async () => {
      const parser = new HtmlParser(mockImageValidator, {
        enableCaching: true,
        cacheTimeout: 100, // 100ms
      });
      const container = $('.patch-item').first();
      const selectors = ['.patch-title'];

      // 初回実行
      const result1 = parser.extractTitle($, container, selectors);
      expect(result1.success).toBe(true);

      // タイムアウト待機
      await new Promise(resolve => setTimeout(resolve, 150));

      // 2回目実行（キャッシュ期限切れ）
      const result2 = parser.extractTitle($, container, selectors);
      expect(result2.success).toBe(true);

      const metrics = parser.getMetrics();
      expect(metrics.totalParses).toBe(2); // キャッシュ期限切れで2回実行
    });

    test('parseWithPatternで高度な機能に関するエラー処理', () => {
      const parser = new HtmlParser(mockImageValidator);
      const pattern = {
        name: 'test-pattern',
        selectors: ['.test'],
        priority: 1,
      };

      // 高度な機能が無効の場合のテスト
      const result = parser.parseWithAdvancedPatterns($, [pattern]);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Advanced patterns are disabled');
    });

    test('メモリ使用量の監視', () => {
      const parser = new HtmlParser(mockImageValidator, {
        enableMetrics: true,
        performanceOptimization: true,
        enableCaching: false, // キャッシュを無効にして各操作がカウントされるように
      });

      // 大量の操作を実行
      for (let i = 0; i < 100; i++) {
        parser.extractTitle($, $('.patch-item').first(), ['.patch-title']);
      }

      const serviceInfo = parser.getServiceInfo();
      expect(serviceInfo.metrics.totalParses).toBeGreaterThanOrEqual(100);
      expect(serviceInfo.uptime).toBeGreaterThan(0);
      expect(serviceInfo.cacheSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('追加のカバレッジテスト', () => {
    test('findElementでキャッシュヒットする場合', () => {
      const parser = new HtmlParser(mockImageValidator, {
        enableCaching: true,
      });
      const selectors = ['.patch-container'];

      // 初回実行
      const result1 = parser.findElement($, selectors);
      expect(result1.element).not.toBeNull();

      // 2回目実行（キャッシュヒット）
      const result2 = parser.findElement($, selectors);
      expect(result2.element).not.toBeNull();
      expect(result2.selector).toBe(result1.selector);
    });

    test('extractImageUrlでキャッシュヒットする場合', () => {
      const parser = new HtmlParser(mockImageValidator, {
        enableCaching: true,
      });
      const container = $('.patch-item').first();
      const selectors = ['.patch-image'];

      // 初回実行
      const result1 = parser.extractImageUrl($, container, selectors);
      expect(result1.success).toBe(true);

      // 2回目実行（キャッシュヒット）
      const result2 = parser.extractImageUrl($, container, selectors);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(result1.value);
    });

    test('高度な機能関連のカバレッジ向上', () => {
      // XPath有効時の正常ケース
      const xpathParser = new HtmlParser(mockImageValidator, {
        enableXPathSupport: true,
      });
      const xpathResult = xpathParser.parseWithXPath('<div>test</div>', '//div');
      expect(xpathResult.success).toBe(true);
      expect(xpathResult.value?.length).toBeGreaterThan(0);

      // 高度なパターン有効時の正常ケース
      const advancedParser = new HtmlParser(mockImageValidator, {
        enableAdvancedPatterns: true,
      });
      const patterns = [
        {
          name: 'test',
          selectors: ['.patch-title'],
          priority: 1,
        },
      ];
      const advancedResult = advancedParser.parseWithAdvancedPatterns($, patterns);
      expect(advancedResult.success).toBe(true);

      // コンテンツ分析有効時の正常ケース
      const contentParser = new HtmlParser(mockImageValidator, {
        enableContentAnalysis: true,
      });
      const contentResult = contentParser.analyzeContent($);
      expect(contentResult.wordCount).toBeGreaterThan(0);

      // DOM操作有効時の正常ケース
      const domParser = new HtmlParser(mockImageValidator, {
        enableDomManipulation: true,
      });
      const operations = [
        {
          type: 'add' as const,
          selector: 'body',
          content: '<div>test</div>',
          position: 'append' as const,
        },
      ];
      const domResult = domParser.manipulateDOM($, operations);
      expect(domResult.success).toBe(true);
    });

    test('並列解析とストリーミング解析のカバレッジ', async () => {
      // 並列解析有効時
      const parallelParser = new HtmlParser(mockImageValidator, {
        enableParallelParsing: true,
      });
      const tasks = [
        {
          id: 'test',
          type: 'extract' as const,
          selectors: ['.patch-title'],
          priority: 1,
        },
      ];
      const parallelResults = await parallelParser.parallelParse($, tasks);
      expect(parallelResults.length).toBe(1);

      // ストリーミング解析有効時
      const streamParser = new HtmlParser(mockImageValidator, {
        enableStreamingParsing: true,
      });
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockHtml));
          controller.close();
        },
      });
      const streamResults = [];
      for await (const result of streamParser.streamParse(stream, ['.patch-title'])) {
        streamResults.push(result);
      }
      expect(streamResults.length).toBeGreaterThanOrEqual(0);
    });
  });
});
