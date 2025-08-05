/**
 * Enhanced ScraperDebugger Test Suite
 * エンタープライズ級デバッグサービスのテストスイート
 */

import * as cheerio from 'cheerio';
import {
  type DebuggerConfig,
  DebugOperationType,
  ExportFormat,
  type ImageAnalysis,
  type PageStructureAnalysis,
  type PatchElementAnalysis,
  ScraperDebugger,
} from './ScraperDebugger';
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

// setIntervalのモック
jest.useFakeTimers();

describe('ScraperDebugger - Enhanced Enterprise Service', () => {
  let scraperDebugger: ScraperDebugger;
  let mockLogger: jest.Mocked<typeof Logger>;
  let mockHtml: string;
  let $: cheerio.CheerioAPI;

  beforeEach(() => {
    mockLogger = Logger as jest.Mocked<typeof Logger>;
    jest.clearAllMocks();

    // 拡張モックHTML作成
    mockHtml = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <div class="sc-4d29e6fd-0 grid-container">
            <div class="patch-item">
              <a href="/patch/14.1" class="patch-link">
                <h2>Patch 14.1 Notes</h2>
                <img src="https://example.com/patch14.1.jpg" alt="Patch 14.1" class="patch-image"/>
                <img data-src="https://example.com/lazy-image.png" alt="Lazy Image" class="lazy-image"/>
              </a>
            </div>
            <div class="patch-item">
              <a href="https://external.com/link" target="_blank" rel="noopener">External Link</a>
            </div>
          </div>
          <div class="sidebar">
            <img src="invalid-image" alt="Invalid"/>
            <img src="" alt="Empty Source"/>
          </div>
        </body>
      </html>
    `;

    $ = cheerio.load(mockHtml);
    scraperDebugger = new ScraperDebugger(undefined, mockLogger);
  });

  afterEach(() => {
    scraperDebugger.clearAllSessions();
    jest.clearAllTimers();
  });

  describe('初期化とセットアップ', () => {
    test('デフォルト設定で正しく初期化される', () => {
      const scraperDebuggerInstance = new ScraperDebugger();

      expect(scraperDebuggerInstance).toBeInstanceOf(ScraperDebugger);
      expect(scraperDebuggerInstance.getActiveSessions()).toHaveLength(0);
    });

    test('カスタム設定で初期化される', () => {
      const config: Partial<DebuggerConfig> = {
        maxSessions: 5,
        sessionTimeout: 10000,
        enableMetrics: false,
        exportFormat: ExportFormat.CSV,
      };

      const _scraperDebuggerInstance = new ScraperDebugger(config, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ScraperDebugger initialized with config:',
        expect.objectContaining(config)
      );
    });
  });

  describe('セッション管理', () => {
    test('新しいセッションを開始できる', () => {
      const sessionId = scraperDebugger.startSession('https://example.com', { test: true });

      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^debug_\d+_[a-z0-9]{6}$/);
      expect(scraperDebugger.getActiveSessions()).toHaveLength(1);

      const session = scraperDebugger.getSession(sessionId);
      expect(session).not.toBeNull();
      if (session) {
        expect(session.url).toBe('https://example.com');
        expect(session.context).toEqual({ test: true });
      }
    });

    test('セッションを正常に終了できる', () => {
      const sessionId = scraperDebugger.startSession();

      // jest.useFakeTimersを使っているため、時間を進める
      jest.advanceTimersByTime(100);

      const endedSession = scraperDebugger.endSession(sessionId);

      expect(endedSession).not.toBeNull();
      if (endedSession) {
        expect(endedSession.endTime).toBeInstanceOf(Date);
        expect(endedSession.metrics.sessionDuration).toBeGreaterThanOrEqual(0);
      }
    });

    test('存在しないセッションの終了はnullを返す', () => {
      const result = scraperDebugger.endSession('non-existent-session');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Session not found: non-existent-session');
    });

    test('全セッションをクリアできる', () => {
      scraperDebugger.startSession();
      scraperDebugger.startSession();

      expect(scraperDebugger.getActiveSessions()).toHaveLength(2);

      scraperDebugger.clearAllSessions();

      expect(scraperDebugger.getActiveSessions()).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('All debug sessions cleared');
    });
  });

  describe('ページ構造分析', () => {
    test('ページ構造を正しく分析する', () => {
      const analysis: PageStructureAnalysis = scraperDebugger.analyzePageStructure($);

      expect(analysis.totalElements).toBeGreaterThan(0);
      expect(analysis.availableClasses).toContain('sc-4d29e6fd-0');
      expect(analysis.availableClasses).toContain('grid-container');
      expect(analysis.gridContainers).toHaveLength(1);
      const EXPECTED_IMAGE_COUNT = 4;
      expect(analysis.imageElements).toHaveLength(EXPECTED_IMAGE_COUNT); // 4つの画像要素
      expect(analysis.linkElements).toHaveLength(2); // 2つのリンク要素
      expect(analysis.structureDepth).toBeGreaterThan(0);
      expect(analysis.uniqueSelectors.length).toBeGreaterThan(0);
    });

    test('セッション付きページ構造分析が記録される', () => {
      const sessionId = scraperDebugger.startSession();
      const analysis = scraperDebugger.analyzePageStructure($, sessionId);

      const session = scraperDebugger.getSession(sessionId);
      expect(session).not.toBeNull();
      if (session) {
        expect(session.operations).toHaveLength(1);

        const operation = session.operations[0];
        expect(operation).toBeDefined();
        expect(operation?.type).toBe(DebugOperationType.PAGE_STRUCTURE);
        expect(operation?.result).toEqual(analysis);
        expect(operation?.duration).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('パッチ要素分析', () => {
    test('パッチ要素を正しく分析する', () => {
      const patchElement = $('.patch-link').first();
      const analysis: PatchElementAnalysis = scraperDebugger.analyzePatchElements($, patchElement);

      expect(analysis.elementCount).toBe(1);
      expect(analysis.tagName).toBe('a');
      expect(analysis.classes).toContain('patch-link');
      expect(analysis.href).toBe('/patch/14.1');
      expect(analysis.children.length).toBeGreaterThan(0);
      expect(analysis.textContent).toContain('Patch 14.1');
      expect(analysis.isValid).toBe(true);
    });

    test('空のパッチ要素の分析', () => {
      const emptyElement = $('.non-existent').first();
      const analysis = scraperDebugger.analyzePatchElements($, emptyElement);

      expect(analysis.elementCount).toBe(0);
      expect(analysis.tagName).toBe('none');
      expect(analysis.isValid).toBe(false);
    });
  });

  describe('画像分析', () => {
    test('コンテナ内の画像を正しく分析する', () => {
      const container = $('.grid-container');
      const analysis: ImageAnalysis = scraperDebugger.analyzeImages($, container);

      expect(analysis.totalImages).toBe(2); // grid-container内の画像
      expect(analysis.validImages).toBe(2); // src/data-srcが有効な画像
      expect(analysis.invalidImages).toBe(0);
      expect(analysis.imageDetails).toHaveLength(2);
      expect(analysis.formats).toHaveProperty('jpg');
      expect(analysis.formats).toHaveProperty('png');
      expect(analysis.sizes.min).toBeGreaterThan(0);
      expect(analysis.sizes.max).toBeGreaterThanOrEqual(analysis.sizes.min);
    });

    test('無効な画像を含む分析', () => {
      const container = $('.sidebar');
      const analysis = scraperDebugger.analyzeImages($, container);

      expect(analysis.totalImages).toBe(2);
      expect(analysis.validImages).toBe(1); // srcが"invalid-image"は有効と判定される
      expect(analysis.invalidImages).toBe(1); // 空のsrcのみ無効
    });
  });

  describe('エクスポート機能', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = scraperDebugger.startSession('https://example.com');
      scraperDebugger.analyzePageStructure($, sessionId);
      scraperDebugger.endSession(sessionId);
    });

    test('JSONフォーマットでエクスポートできる', () => {
      const jsonExport = scraperDebugger.exportSession(sessionId, ExportFormat.JSON);
      const parsed = JSON.parse(jsonExport);

      expect(parsed.id).toBe(sessionId);
      expect(parsed.url).toBe('https://example.com');
      expect(parsed.operations).toHaveLength(1);
      expect(parsed.metrics).toBeDefined();
    });

    test('CSVフォーマットでエクスポートできる', () => {
      const csvExport = scraperDebugger.exportSession(sessionId, ExportFormat.CSV);
      const lines = csvExport.split('\n');

      expect(lines[0]).toBe('operation_id,type,timestamp,duration,success,error');
      expect(lines).toHaveLength(2); // ヘッダー + 1操作
      expect(lines[1]).toContain('page_structure');
      expect(lines[1]).toContain('true'); // 成功
    });

    test('HTMLフォーマットでエクスポートできる', () => {
      const htmlExport = scraperDebugger.exportSession(sessionId, ExportFormat.HTML);

      expect(htmlExport).toContain('<!DOCTYPE html>');
      expect(htmlExport).toContain(`Debug Session: ${sessionId}`);
      expect(htmlExport).toContain('https://example.com');
      expect(htmlExport).toContain('page_structure');
    });
  });

  describe('後方互換性テスト', () => {
    it('ページ構造を正しくログ出力する', () => {
      const html = `
        <div class="container">
          <div class="sc-4d29e6fd-0">
            <span class="child1">Child 1</span>
            <span class="child2">Child 2</span>
          </div>
        </div>
      `;
      const $ = cheerio.load(html);

      scraperDebugger.logPageStructure($);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Total elements found:')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Available classes:'));
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Grid containers found:')
      );
    });

    it('グリッドコンテナが存在しない場合も正常に動作する', () => {
      const html = '<div class="other">Content</div>';
      const $ = cheerio.load(html);

      scraperDebugger.logPageStructure($);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Total elements found:')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Grid containers found:')
      );
    });
  });

  describe('logPatchElement', () => {
    it('パッチ要素の情報を正しくログ出力する', () => {
      const html = `
        <a href="/patch-14-1" class="patch-link">
          <span class="title">Patch 14.1</span>
          <div class="content">
            <p>Patch content</p>
          </div>
        </a>
      `;
      const $ = cheerio.load(html);
      const patchElement = $('a');

      scraperDebugger.logPatchElement($, patchElement);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found patch element with tag:')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Patch element classes:')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Patch element children:')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Patch element href:'));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Patch element text:'));
    });

    it('要素が存在しない場合も正常に動作する', () => {
      const html = '<div>No patch</div>';
      const $ = cheerio.load(html);
      const patchElement = $('nonexistent');

      scraperDebugger.logPatchElement($, patchElement);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found patch element with tag: none')
      );
    });
  });

  describe('logContainerImages', () => {
    it('コンテナ内の画像情報を正しくログ出力する', () => {
      const html = `
        <div class="container">
          <img src="https://example.com/image1.jpg" class="image1" />
          <img data-src="https://example.com/image2.png" class="image2" />
          <img class="image3" />
        </div>
      `;
      const $ = cheerio.load(html);
      const container = $('.container');

      scraperDebugger.logContainerImages($, container);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Total images in container:')
      );
    });

    it('画像が存在しない場合も正常に動作する', () => {
      const html = '<div class="container">No images</div>';
      const $ = cheerio.load(html);
      const container = $('.container');

      scraperDebugger.logContainerImages($, container);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Total images in container: 0')
      );
    });
  });

  describe('メトリクス機能', () => {
    test('セッションメトリクスを正しく計算する', () => {
      const sessionId = scraperDebugger.startSession();

      // 成功操作
      scraperDebugger.analyzePageStructure($, sessionId);

      // 失敗操作 - エラーが記録されるような操作を実行
      const invalidCheerio = {
        find: () => {
          throw new Error('Test error');
        },
      } as unknown as cheerio.CheerioAPI;

      try {
        scraperDebugger.analyzePageStructure(invalidCheerio, sessionId);
      } catch {
        // エラーを無視
      }

      const metrics = scraperDebugger.getSessionMetrics(sessionId);

      expect(metrics).not.toBeNull();
      if (metrics) {
        expect(metrics.totalOperations).toBe(2);
        expect(metrics.successfulOperations).toBe(1);
        expect(metrics.failedOperations).toBe(1);
        expect(metrics.averageOperationTime).toBeGreaterThanOrEqual(0);
      }
    });

    test('存在しないセッションのメトリクスはnullを返す', () => {
      const metrics = scraperDebugger.getSessionMetrics('non-existent');
      expect(metrics).toBeNull();
    });
  });

  describe('エラーハンドリング', () => {
    test('予期しないエラーが適切に処理される', () => {
      const sessionId = scraperDebugger.startSession();

      // Cheerio APIオブジェクトを壊す - $('*')の呼び出しでエラーが発生するようにする
      const brokenCheerio = (() => {
        const fn = (): never => {
          throw new Error('Cheerio error');
        };
        fn.find = (): never => {
          throw new Error('Cheerio error');
        };
        return fn;
      })() as unknown as cheerio.CheerioAPI;

      expect(() => {
        scraperDebugger.analyzePageStructure(brokenCheerio, sessionId);
      }).toThrow('Cheerio error');

      const session = scraperDebugger.getSession(sessionId);
      expect(session).not.toBeNull();
      if (session) {
        const operation = session.operations[0];
        expect(operation?.error).toBe('Cheerio error');
      }
    });

    test('部分的な失敗でも処理を継続する', () => {
      const sessionId = scraperDebugger.startSession();

      // 1つの操作を失敗させる
      try {
        scraperDebugger.analyzePageStructure({} as cheerio.CheerioAPI, sessionId);
      } catch {
        // 無視
      }

      // 次の操作は成功する
      scraperDebugger.analyzePageStructure($, sessionId);

      const session = scraperDebugger.getSession(sessionId);
      expect(session).not.toBeNull();
      if (session) {
        expect(session.operations).toHaveLength(2);
        expect(session.metrics.successfulOperations).toBe(1);
        expect(session.metrics.failedOperations).toBe(1);
      }
    });
  });

  describe('追加のカバレッジテスト', () => {
    test('最大セッション数を超えた場合、最も古いセッションがクリーンアップされる', () => {
      // maxSessions: 2でデバッガーを作成
      const limitedDebugger = new ScraperDebugger({ maxSessions: 2 }, mockLogger);

      const session1 = limitedDebugger.startSession();
      jest.advanceTimersByTime(100);
      const session2 = limitedDebugger.startSession();
      jest.advanceTimersByTime(100);

      // 3つ目のセッションを開始すると、最も古いセッションが削除される
      const session3 = limitedDebugger.startSession();

      expect(limitedDebugger.getSession(session1)).toBeNull();
      expect(limitedDebugger.getSession(session2)).not.toBeNull();
      expect(limitedDebugger.getSession(session3)).not.toBeNull();
      expect(limitedDebugger.getActiveSessions()).toHaveLength(2);
    });

    test('自動エクスポートが有効な場合、セッション終了時にエクスポートされる', () => {
      const autoExportDebugger = new ScraperDebugger(
        {
          enableAutoExport: true,
          exportFormat: ExportFormat.JSON,
        },
        mockLogger
      );

      const sessionId = autoExportDebugger.startSession();
      autoExportDebugger.analyzePageStructure($, sessionId);

      // exportSessionが成功するようにモック
      jest
        .spyOn(autoExportDebugger, 'exportSession')
        .mockImplementation(() => JSON.stringify({ test: 'data' }));

      autoExportDebugger.endSession(sessionId);

      expect(autoExportDebugger.exportSession).toHaveBeenCalledWith(sessionId, ExportFormat.JSON);
    });

    test('自動エクスポートがエラーになってもセッション終了は成功する', () => {
      const autoExportDebugger = new ScraperDebugger(
        {
          enableAutoExport: true,
          exportFormat: ExportFormat.JSON,
        },
        mockLogger
      );

      const sessionId = autoExportDebugger.startSession();

      // exportSessionがエラーを投げるようにモック
      jest.spyOn(autoExportDebugger, 'exportSession').mockImplementation(() => {
        throw new Error('Export failed');
      });

      const endedSession = autoExportDebugger.endSession(sessionId);

      expect(endedSession).not.toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Auto-export failed for session ${sessionId}:`,
        expect.any(Error)
      );
    });

    test('エクスポート時にセッションが存在しない場合エラーを投げる', () => {
      expect(() => {
        scraperDebugger.exportSession('non-existent', ExportFormat.JSON);
      }).toThrow('Session not found: non-existent');
    });

    test('サポートされていないエクスポート形式でエラーを投げる', () => {
      const sessionId = scraperDebugger.startSession();
      scraperDebugger.endSession(sessionId);

      expect(() => {
        scraperDebugger.exportSession(sessionId, 'invalid' as ExportFormat);
      }).toThrow('Unsupported export format: invalid');
    });

    test('ID属性を持つ要素からユニークセレクタを生成する', () => {
      const htmlWithIds = `
        <html>
          <body>
            <div id="unique-id">Content</div>
            <span id="another-id">Text</span>
          </body>
        </html>
      `;
      const $withIds = cheerio.load(htmlWithIds);

      const analysis = scraperDebugger.analyzePageStructure($withIds);

      expect(analysis.uniqueSelectors).toContain('#unique-id');
      expect(analysis.uniqueSelectors).toContain('#another-id');
    });

    test('セッションタイムアウトによる自動クリーンアップ', () => {
      const shortTimeoutDebugger = new ScraperDebugger(
        {
          sessionTimeout: 1000, // 1秒
        },
        mockLogger
      );

      const sessionId = shortTimeoutDebugger.startSession();

      expect(shortTimeoutDebugger.getSession(sessionId)).not.toBeNull();

      // タイムアウト時間を超えて時間を進める
      const SIX_MINUTES_MS = 6 * 60 * 1000;
      jest.advanceTimersByTime(SIX_MINUTES_MS); // 6分進める（クリーンアップ間隔は5分）

      expect(shortTimeoutDebugger.getSession(sessionId)).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(`Session expired: ${sessionId}`);
    });

    test('パッチ要素分析でエラーが発生した場合の処理', () => {
      const sessionId = scraperDebugger.startSession();

      // extractAttributesでエラーが発生するようなモック
      const brokenElement = {
        length: 1,
        attr: () => 'test',
        prop: () => 'div',
        text: () => 'text',
        get: () => {
          throw new Error('Extract attributes error');
        },
        children: () => [],
      } as any;

      expect(() => {
        scraperDebugger.analyzePatchElements($, brokenElement, sessionId);
      }).toThrow('Extract attributes error');

      const session = scraperDebugger.getSession(sessionId);
      expect(session).not.toBeNull();
      if (session) {
        const operation = session.operations[0];
        expect(operation?.type).toBe(DebugOperationType.PATCH_ELEMENT);
        expect(operation?.error).toBe('Extract attributes error');
      }
    });

    test('画像分析でエラーが発生した場合の処理', () => {
      const sessionId = scraperDebugger.startSession();

      // findでエラーが発生するようなモック
      const brokenContainer = {
        find: () => {
          throw new Error('Image find error');
        },
      } as any;

      expect(() => {
        scraperDebugger.analyzeImages($, brokenContainer, sessionId);
      }).toThrow('Image find error');

      const session = scraperDebugger.getSession(sessionId);
      expect(session).not.toBeNull();
      if (session) {
        const operation = session.operations[0];
        expect(operation?.type).toBe(DebugOperationType.IMAGE_ANALYSIS);
        expect(operation?.error).toBe('Image find error');
      }
    });
  });

  describe('カバレッジ完成テスト', () => {
    test('sessionIdなしでの画像分析（recordOperationスキップ）', () => {
      // sessionIdなしで画像分析を実行
      const analysis = scraperDebugger.analyzeImages($, $('.grid-container'));

      expect(analysis.totalImages).toBe(2);
      expect(analysis.validImages).toBe(2);
      // recordOperationは呼ばれないのでセッションに操作が記録されない
    });

    test('sessionIdなしでのパッチ要素分析（recordPatchElementOperationスキップ）', () => {
      // sessionIdなしでパッチ要素分析を実行
      const patchElement = $('.patch-link').first();
      const analysis = scraperDebugger.analyzePatchElements($, patchElement);

      expect(analysis.elementCount).toBe(1);
      expect(analysis.isValid).toBe(true);
      // recordPatchElementOperationは呼ばれないのでセッションに操作が記録されない
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
              <img src="https://example.com/image${i}.jpg" alt="Image ${i}"/>
              <a href="/link${i}">Link ${i}</a>
            </div>
          `
          ).join('')}
        </body></html>
      `;

      const large$ = cheerio.load(largeHtml);
      const startTime = performance.now();

      const analysis = scraperDebugger.analyzePageStructure(large$);

      const endTime = performance.now();
      const duration = endTime - startTime;

      const MIN_ELEMENTS = 300;
      const MAX_DURATION_MS = 1000;
      const EXPECTED_IMAGES = 100;
      const EXPECTED_LINKS = 100;

      expect(analysis.totalElements).toBeGreaterThan(MIN_ELEMENTS); // 大量の要素
      expect(duration).toBeLessThan(MAX_DURATION_MS); // 1秒以内
      expect(analysis.imageElements).toHaveLength(EXPECTED_IMAGES);
      expect(analysis.linkElements).toHaveLength(EXPECTED_LINKS);
    });

    test('操作時間が正しく記録される', () => {
      const sessionId = scraperDebugger.startSession();
      scraperDebugger.analyzePageStructure($, sessionId);

      const session = scraperDebugger.getSession(sessionId);
      expect(session).not.toBeNull();
      if (session) {
        const operation = session.operations[0];
        expect(operation?.duration).toBeGreaterThanOrEqual(0);
        const ONE_SECOND_MS = 1000;
        expect(operation?.duration).toBeLessThan(ONE_SECOND_MS); // 1秒以内
      }
    });
  });
});
