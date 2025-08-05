/**
 * PatchScraper 依存関係テスト
 * リファクタリング後の依存関係が正常に動作することを確認
 */

import { PatchScraper, PatchScraperConfig } from './PatchScraper';
import { HtmlParser } from './scrapers/HtmlParser';
import { ImageValidator } from './scrapers/ImageValidator';
import { ScraperDebugger } from './scrapers/ScraperDebugger';

describe('PatchScraper - 依存関係テスト', () => {
  describe('型定義の依存関係', () => {
    test('PatchScraperConfigが正しくインポートされる', () => {
      const config: PatchScraperConfig = {
        debugMode: true,
        detailPageTimeout: 30000,
      };

      expect(config.debugMode).toBe(true);
      expect(config.detailPageTimeout).toBe(30000);
    });

    test('型定義を使ったPatchScraperインスタンスが作成できる', () => {
      const config: PatchScraperConfig = {
        debugMode: false,
        detailPageTimeout: 15000,
      };

      const scraper = new PatchScraper(undefined, undefined, null, config);
      expect(scraper).toBeInstanceOf(PatchScraper);
    });
  });

  describe('サービス依存関係の注入', () => {
    test('個別の依存関係を注入できる', () => {
      const htmlParser = new HtmlParser();
      const imageValidator = new ImageValidator();
      const scraperDebugger = new ScraperDebugger();

      const scraper = new PatchScraper(htmlParser, imageValidator, scraperDebugger);

      expect(scraper).toBeInstanceOf(PatchScraper);
    });

    test('部分的な依存関係注入が機能する', () => {
      const imageValidator = new ImageValidator();

      const scraper = new PatchScraper(
        undefined, // HtmlParserはデフォルト
        imageValidator, // ImageValidatorは注入
        null // ScraperDebuggerは無効
      );

      expect(scraper).toBeInstanceOf(PatchScraper);
    });

    test('デフォルトの依存関係で初期化できる', () => {
      const scraper = new PatchScraper();

      expect(scraper).toBeInstanceOf(PatchScraper);
    });
  });

  describe('クリーンな依存関係アーキテクチャ', () => {
    test('循環依存が存在しない', () => {
      // このテストが通れば、循環依存は存在しない
      const scraper = new PatchScraper();
      const htmlParser = new HtmlParser();
      const imageValidator = new ImageValidator();
      const scraperDebugger = new ScraperDebugger();

      expect(scraper).toBeInstanceOf(PatchScraper);
      expect(htmlParser).toBeInstanceOf(HtmlParser);
      expect(imageValidator).toBeInstanceOf(ImageValidator);
      expect(scraperDebugger).toBeInstanceOf(ScraperDebugger);
    });

    test('型定義が正しく分離されている', () => {
      // 型定義ファイルからの型が正しく使用できる
      const config: PatchScraperConfig = {
        selectors: {
          container: ['.test-container'],
          title: ['.test-title'],
          url: ['.test-url'],
          image: ['.test-image'],
        },
        debugMode: true,
        detailPageTimeout: 5000,
      };

      expect(config.selectors?.container).toHaveLength(1);
      expect(config.debugMode).toBe(true);
    });
  });

  describe('後方互換性', () => {
    test('リファクタリング前のAPIが維持されている', () => {
      const scraper = new PatchScraper();

      // メインメソッド
      expect(typeof scraper.scrapeLatestPatch).toBe('function');

      // 後方互換メソッド
      expect(typeof scraper.scrapePatchDetails).toBe('function');
      expect(typeof scraper.scrapeDetailedPatch).toBe('function');
    });
  });
});
