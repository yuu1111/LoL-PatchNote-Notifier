/**
 * League of Legends Patch Notifier
 * メインアプリケーションエントリーポイント
 */

import 'dotenv/config';
import { PatchScraper } from './services/PatchScraper';
import { DiscordNotifier } from './services/DiscordNotifier';
import { ImageDownloader } from './services/ImageDownloader';
import { GeminiSummarizer } from './services/GeminiSummarizer';
import { StateManager } from './services/StateManager';
import { Scheduler } from './services/Scheduler';
import { Logger } from './utils/logger';
import { config } from './config/config';
import {
  AppError,
  DiscordError,
  type GeminiSummary,
  NetworkError,
  type PatchNote,
  ScrapingError,
} from './types/types';

/**
 * メインアプリケーションクラス
 */
export class App {
  private readonly patchScraper: PatchScraper;
  private readonly discordNotifier: DiscordNotifier;
  private readonly imageDownloader: ImageDownloader;
  private readonly geminiSummarizer: GeminiSummarizer;
  private readonly stateManager: StateManager;
  private readonly scheduler: Scheduler;
  private isShuttingDown = false;

  constructor() {
    this.patchScraper = new PatchScraper();
    this.discordNotifier = new DiscordNotifier();
    this.imageDownloader = new ImageDownloader();
    this.geminiSummarizer = new GeminiSummarizer();
    this.stateManager = new StateManager();
    this.scheduler = new Scheduler();
  }

  /**
   * アプリケーション開始
   */
  public async start(): Promise<void> {
    try {
      Logger.info('🎮 LoL Patch Notifier を開始しています...');

      // 状態管理システムを初期化
      await this.stateManager.setRunningState(true);
      await this.stateManager.validateState();

      // 標準パッチ検出システムでスケジューラーを開始
      Logger.info('📋 標準パッチ検出システムを使用します');
      this.scheduler.start(() => this.checkForPatches());

      Logger.info(`✅ アプリケーションが正常に開始されました`);
      Logger.info(`📋 設定: パッチノートURL=${config.lol.patchNotesUrl}`);
      Logger.info(`🔄 監視間隔: ${config.monitoring.checkIntervalMinutes}分`);
    } catch (error) {
      Logger.error('❌ アプリケーションの開始に失敗しました', error);
      throw error;
    }
  } /**
   * アプリケーション停止
   */
  public async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      Logger.info('🛑 LoL Patch Notifier を停止しています...');

      // スケジューラーを停止
      this.scheduler.stop();

      // 実行状態を停止に更新
      await this.stateManager.setRunningState(false);

      // バックアップを作成
      await this.stateManager.createBackup();

      Logger.info('✅ アプリケーションが正常に停止しました');
    } catch (error) {
      Logger.error('❌ アプリケーションの停止中にエラーが発生しました', error);
    }
  }

  /**
   * パッチノート監視の実行
   */
  public async checkForPatches(): Promise<void> {
    try {
      Logger.info('🔍 新しいパッチノートをチェック中...');

      const latestPatch = await this.patchScraper.scrapeLatestPatch();
      if (!latestPatch) {
        Logger.info('📝 パッチノートが見つかりませんでした');
        return;
      }

      Logger.info(`📋 パッチを発見: ${latestPatch.title} (v${latestPatch.version})`);

      const isAlreadyNotified = await this.stateManager.isAlreadyNotified(latestPatch);
      if (isAlreadyNotified) {
        Logger.info('✅ このパッチは既に通知済みです');
        return;
      }

      // 新しいパッチなので詳細情報を取得してから通知処理
      await this.enrichPatchWithDetails(latestPatch);
      await this.processPatchNotification(latestPatch);
    } catch (error) {
      await this.handleError(error, 'パッチノートチェック処理');
    }
  }

  /**
   * パッチ詳細情報の補強（キャッシュまたは新規取得）
   */
  private async enrichPatchWithDetails(latestPatch: PatchNote): Promise<void> {
    const hasCachedDetails = await this.stateManager.hasPatchDetails(latestPatch.version);

    if (hasCachedDetails) {
      await this.loadCachedPatchDetails(latestPatch);
    } else {
      await this.fetchNewPatchDetails(latestPatch);
    }
  }

  /**
   * キャッシュからパッチ詳細を読み込み
   */
  private async loadCachedPatchDetails(latestPatch: PatchNote): Promise<void> {
    Logger.info('📂 既存のパッチデータを使用します');
    const cachedPatch = await this.stateManager.loadPatchDetails(latestPatch.version);

    if (cachedPatch) {
      this.mergeCachedDataIntoPatch(latestPatch, cachedPatch);
      Logger.info('✅ キャッシュからパッチ詳細を復元しました');
    }
  }

  /**
   * 新規パッチ詳細を取得
   */
  private async fetchNewPatchDetails(latestPatch: PatchNote): Promise<void> {
    Logger.info('🆕 新しいパッチの詳細を取得中...');
    const fullPatchData = await this.patchScraper.scrapePatchDetails(latestPatch.url);

    if (fullPatchData.content) {
      latestPatch.content = fullPatchData.content;
    }
    if (fullPatchData.imageUrl) {
      latestPatch.imageUrl = fullPatchData.imageUrl;
    }
  }

  /**
   * キャッシュデータをメインパッチ情報にマージ
   */
  private mergeCachedDataIntoPatch(latestPatch: PatchNote, cachedPatch: PatchNote): void {
    if (cachedPatch.content) {
      latestPatch.content = cachedPatch.content;
    }
    if (cachedPatch.imageUrl) {
      latestPatch.imageUrl = cachedPatch.imageUrl;
    }
    if (cachedPatch.localImagePath) {
      latestPatch.localImagePath = cachedPatch.localImagePath;
    }
  }

  /**
   * パッチ通知処理
   */
  private async processPatchNotification(latestPatch: PatchNote): Promise<void> {
    const localImagePath = await this.downloadPatchImage(latestPatch);
    await this.stateManager.savePatchDetails(latestPatch);
    Logger.info('💾 パッチ詳細データを保存しました');

    const summary = await this.generatePatchSummary(latestPatch);

    await this.discordNotifier.sendPatchNotification(
      latestPatch,
      localImagePath,
      summary ?? undefined
    );
    Logger.info('🚀 Discord通知を送信しました');

    await this.stateManager.markNotificationSent(latestPatch);
    Logger.info(`✅ パッチ通知処理が完了しました: ${latestPatch.version}`);
  }

  /**
   * パッチ画像をダウンロード
   */
  private async downloadPatchImage(latestPatch: PatchNote): Promise<string | undefined> {
    // 既にローカルパスが設定されている場合（キャッシュから復元）
    if (latestPatch.localImagePath) {
      const exists = await this.imageDownloader.isImageCached(
        latestPatch.imageUrl ?? '',
        latestPatch.version
      );
      if (exists) {
        Logger.info(`🖼️ キャッシュ済みの画像を使用: ${latestPatch.localImagePath}`);
        return latestPatch.localImagePath;
      }
    }

    if (!latestPatch.imageUrl) {
      return undefined;
    }

    try {
      const localImagePath = await this.imageDownloader.downloadPatchImage(
        latestPatch.imageUrl,
        latestPatch.version
      );
      latestPatch.localImagePath = localImagePath;
      Logger.info(`🖼️ パッチ画像をダウンロード: ${localImagePath}`);
      return localImagePath;
    } catch (imageError) {
      Logger.warn('⚠️ パッチ画像のダウンロードに失敗しましたが、通知は継続します', imageError);
      return undefined;
    }
  }

  /**
   * パッチ要約生成
   */
  private async generatePatchSummary(latestPatch: PatchNote): Promise<GeminiSummary | null> {
    if (!latestPatch.content) {
      Logger.info('ℹ️ パッチのコンテンツが無いため、要約生成をスキップします');
      return null;
    }

    try {
      Logger.info('🤖 保存されたパッチデータからGemini AIで要約を生成中...');
      const savedPatch = await this.stateManager.loadPatchDetails(latestPatch.version);

      if (!savedPatch) {
        Logger.warn('⚠️ 保存されたパッチデータの読み込みに失敗しました');
        return null;
      }

      const summary = await this.geminiSummarizer.generateSummary(savedPatch);
      if (summary) {
        Logger.info('✅ パッチノート要約が生成されました');
        latestPatch.summary = summary.summary;
        return summary;
      }

      Logger.warn('⚠️ Gemini要約の生成に失敗しましたが、通知は継続します');
      return null;
    } catch (summaryError) {
      Logger.warn('⚠️ Gemini要約の生成中にエラーが発生しましたが、通知は継続します', summaryError);
      return null;
    }
  }

  /**
   * エラーハンドリング
   */
  private async handleError(error: unknown, context: string): Promise<void> {
    let errorMessage = `${context}中にエラーが発生しました`;

    if (error instanceof ScrapingError) {
      errorMessage = `スクレイピングエラー: ${error.message}`;
      Logger.error(errorMessage, error);
    } else if (error instanceof NetworkError) {
      errorMessage = `ネットワークエラー: ${error.message}`;
      Logger.error(errorMessage, error);
    } else if (error instanceof DiscordError) {
      errorMessage = `Discord通知エラー: ${error.message}`;
      Logger.error(errorMessage, error);
    } else if (error instanceof AppError) {
      errorMessage = `アプリケーションエラー: ${error.message}`;
      Logger.error(errorMessage, error);
    } else {
      Logger.error(errorMessage, error);
    }

    // 重要なエラーの場合はDiscordに通知
    try {
      if (error instanceof ScrapingError || error instanceof DiscordError) {
        await this.discordNotifier.sendErrorNotification(
          error instanceof Error ? error : new Error(String(error)),
          context
        );
      }
    } catch (notificationError) {
      Logger.error('エラー通知の送信に失敗しました', notificationError);
    }
  } /**
   * テスト通知の送信
   */
  public async sendTestNotification(): Promise<void> {
    try {
      Logger.info('🧪 テスト通知を送信中...');
      await this.discordNotifier.sendTestNotification();
      Logger.info('✅ テスト通知が正常に送信されました');
    } catch (error) {
      Logger.error('❌ テスト通知の送信に失敗しました', error);
      throw error;
    }
  }

  /**
   * アプリケーションの健全性チェック
   */
  public async healthCheck(): Promise<boolean> {
    try {
      Logger.info('🔍 健全性チェックを実行中...');

      // Discord Webhook URLの検証
      if (!DiscordNotifier.validateWebhookUrl(config.discord.webhookUrl)) {
        Logger.error('❌ Discord Webhook URLが無効です');
        return false;
      }

      // 状態管理システムの検証
      const stateValid = await this.stateManager.validateState();
      if (!stateValid) {
        Logger.error('❌ 状態管理システムに問題があります');
        return false;
      }

      Logger.info('✅ 健全性チェック完了');
      return true;
    } catch (error) {
      Logger.error('❌ 健全性チェック中にエラーが発生しました', error);
      return false;
    }
  }

  /**
   * アプリケーションのステータス情報を取得
   */
  public getStatus(): {
    isRunning: boolean;
    scheduler: object;
    state: object | null;
  } {
    return {
      isRunning: !this.isShuttingDown,
      scheduler: this.scheduler.getStatus(),
      state: this.stateManager.getCurrentState(),
    };
  }

  /**
   * 手動でパッチチェックを実行
   */
  public async executeManualCheck(): Promise<void> {
    try {
      Logger.info('🖱️ 手動パッチチェックを実行中...');
      await this.scheduler.executeManually(() => this.checkForPatches());
    } catch (error) {
      Logger.error('❌ 手動パッチチェックに失敗しました', error);
      throw error;
    }
  }
}

// メイン実行部分
// ESM環境でのメイン実行判定
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') ?? '');
if (isMainModule) {
  const app = new App();

  // シグナルハンドラー
  process.on('SIGINT', () => {
    void (async (): Promise<void> => {
      Logger.info('📡 SIGINT受信 - アプリケーションを終了中...');
      await app.stop();
      process.exit(0);
    })();
  });

  process.on('SIGTERM', () => {
    void (async (): Promise<void> => {
      Logger.info('📡 SIGTERM受信 - アプリケーションを終了中...');
      await app.stop();
      process.exit(0);
    })();
  });

  // 未処理の例外をキャッチ
  process.on('uncaughtException', error => {
    void (async (): Promise<void> => {
      Logger.error('💥 未処理の例外が発生しました', error);
      await app.stop();
      process.exit(1);
    })();
  });

  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('💥 未処理のPromise拒否が発生しました', { reason, promise });
    app
      .stop()
      .then(() => {
        process.exit(1);
      })
      .catch(() => {
        process.exit(1);
      });
  });

  // アプリケーション開始
  app.start().catch(async error => {
    Logger.error('💥 アプリケーションの開始に失敗しました', error);
    await app.stop();
    process.exit(1);
  });
}
