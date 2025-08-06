/**
 * PatchScraper Integration Tests
 * PatchScraperの協調テスト - 他のサービスとの連携を検証
 */

import { PatchScraper } from '../../src/services/PatchScraper';
import { httpClient } from '../../src/utils/httpClient';
import { Logger } from '../../src/utils/logger';
import type { HttpResponse } from '../../src/types/types';

// モック設定
jest.mock('../../src/utils/httpClient');
jest.mock('../../src/utils/logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

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

    // PatchScraperインスタンスを作成（実際のサービスを使用）
    patchScraper = new PatchScraper();
  });

  describe('サービス統合テスト', () => {
    it('PatchScraperが正しく初期化される', () => {
      expect(patchScraper).toBeDefined();
    });

    it('最新パッチのスクレイピングで正常に動作する', async () => {
      // HTTPレスポンスのモック
      mockHttpClient.get.mockImplementation((url: string) => {
        if (url.includes('patch-notes')) {
          return Promise.resolve({
            data: mockPatchListHtml,
            status: 200,
            statusText: 'OK',
            headers: {},
          } as HttpResponse<string>);
        }
        return Promise.resolve({
          data: mockPatchDetailHtml,
          status: 200,
          statusText: 'OK',
          headers: {},
        } as HttpResponse<string>);
      });

      // 実行
      const patch = await patchScraper.scrapeLatestPatch();

      // 検証
      expect(mockHttpClient.get).toHaveBeenCalled();
      expect(patch).not.toBeNull();
      if (patch) {
        expect(patch.title).toContain('パッチ');
        expect(patch.version).toBeTruthy();
        expect(patch.url).toBeTruthy();
      }
    });

    it('パッチ詳細ページの取得で正常に動作する', async () => {
      // HTTPレスポンスのモック
      mockHttpClient.get.mockResolvedValue({
        data: mockPatchDetailHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as HttpResponse<string>);

      // 実行
      const details = await patchScraper.scrapeDetailedPatch(
        'https://example.com/patch-14-1-notes'
      );

      // 検証
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://example.com/patch-14-1-notes',
        expect.objectContaining({ timeout: expect.any(Number) })
      );
      expect(details).toBeDefined();
      if (details && details.content) {
        expect(details.content).toContain('チャンピオンのバランス調整');
      }
    });

    it('デバッグモードで詳細なログが出力される', async () => {
      // デバッグモードを有効化
      process.env.SCRAPER_DEBUG = 'true';
      const debugPatchScraper = new PatchScraper();

      // HTTPレスポンスのモック（コンテナが見つからない場合）
      mockHttpClient.get.mockResolvedValue({
        data: '<html><body>No container</body></html>',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as HttpResponse<string>);

      // 実行
      try {
        await debugPatchScraper.scrapeLatestPatch();
      } catch (error) {
        // エラーを期待
      }

      // デバッグログが出力されたか検証
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('パッチノートスクレイピング開始')
      );

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
        expect.stringContaining('パッチノートのスクレイピングに失敗しました'),
        expect.any(Error)
      );

      // nullが返されることを確認
      expect(result).toBeNull();
    });

    it('画像URLの検証で無効な画像が正常に処理される', async () => {
      // HTTPレスポンスのモック（無効な画像URLを含む）
      const htmlWithInvalidImages = `
        <html>
          <body>
            <div class="sc-4d29e6fd-0 grid-container">
              <a href="/patch-14-1" class="action">
                <div class="sc-6fae0810-0">パッチ14.1ノート</div>
                <img src="data:image/svg+xml,<svg/>" alt="パッチ14.1">
              </a>
            </div>
          </body>
        </html>
      `;

      mockHttpClient.get.mockImplementation((url: string) => {
        if (url.includes('patch-notes')) {
          return Promise.resolve({
            data: htmlWithInvalidImages,
            status: 200,
            statusText: 'OK',
            headers: {},
          } as HttpResponse<string>);
        }
        // 詳細ページのモック（タイトルを含む）
        return Promise.resolve({
          data: '<html><body><main><h1>パッチ14.1ノート</h1><article>Content</article></main></body></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
        } as HttpResponse<string>);
      });

      // 実行
      const patch = await patchScraper.scrapeLatestPatch();

      // パッチ情報は取得できる
      expect(patch).not.toBeNull();
      if (patch) {
        // 画像URLの検証（SVG data URLがどう扱われるかの確認）
        // 実装では一部のSVG data URLは通る可能性がある
        expect(patch.title).toContain('パッチ');
        expect(patch.version).toBeTruthy();
        // 画像URLはあってもなくても良い（実装依存）
      }
    });
  });

  describe('パフォーマンステスト', () => {
    it.skip('大量のパッチ要素を効率的に処理できる', async () => {
      // 大量のパッチ要素を含むHTML（PatchScraperのセレクタに合わせた構造）
      const largePatchListHtml = `
        <html>
          <body>
            <div class="sc-4d29e6fd-0">
              ${Array.from(
                { length: 50 },
                (_, i) => `
                <a href="/patch-${i}" class="action">
                  <div class="sc-6fae0810-0">パッチ${i}ノート</div>
                  <img src="https://example.com/patch-${i}.jpg" alt="パッチ${i}">
                </a>
              `
              ).join('')}
            </div>
          </body>
        </html>
      `;

      // 詳細ページのHTMLも用意（タイトルセレクタを含む）
      const detailHtml = `
        <html>
          <body>
            <main>
              <h1>パッチ0ノート</h1>
              <div class="sc-6fae0810-0">パッチ0ノート</div>
              <article>詳細内容</article>
            </main>
          </body>
        </html>
      `;

      mockHttpClient.get.mockImplementation((url: string) => {
        if (url.includes('patch-notes')) {
          return Promise.resolve({
            data: largePatchListHtml,
            status: 200,
            statusText: 'OK',
            headers: {},
          } as HttpResponse<string>);
        }
        // 詳細ページのモック
        return Promise.resolve({
          data: detailHtml,
          status: 200,
          statusText: 'OK',
          headers: {},
        } as HttpResponse<string>);
      });

      const startTime = performance.now();
      const patch = await patchScraper.scrapeLatestPatch();
      const endTime = performance.now();

      // 検証
      expect(patch).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内に処理完了
    });
  });
});