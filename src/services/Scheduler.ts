/**
 * Scheduler service
 * setIntervalを使用したシンプルな定期実行
 */

import { Logger } from '../utils/logger';
import { config } from '../config';
import { AppError } from '../types';

export class Scheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastExecutionTime: Date | null = null;
  private totalExecutions = 0;
  private readonly intervalMinutes: number;

  // Time constants
  private static readonly MINUTES_IN_HOUR = 60; // eslint-disable-line no-magic-numbers
  private static readonly MS_IN_SECOND = 1000;
  private static readonly SECONDS_IN_MINUTE = 60; // eslint-disable-line no-magic-numbers
  private static readonly MINUTES_IN_DAY = 1440; // eslint-disable-line no-magic-numbers

  constructor() {
    this.intervalMinutes = config.monitoring.checkIntervalMinutes;
  }

  /**
   * スケジューラーを開始
   */
  public start(callback: () => Promise<void>): void {
    try {
      if (this.isRunning) {
        Logger.warn('⚠️ スケジューラーは既に実行中です');
        return;
      }

      // 間隔をミリ秒に変換
      const intervalMs =
        this.intervalMinutes * Scheduler.SECONDS_IN_MINUTE * Scheduler.MS_IN_SECOND;

      Logger.info(`⏰ スケジューラーを開始: ${this.intervalMinutes}分間隔 (${intervalMs}ms)`);

      this.intervalId = setInterval(() => {
        void this.executeTask(callback);
      }, intervalMs);

      this.isRunning = true;

      Logger.info('✅ スケジューラーが正常に開始されました');

      // 起動時に即座に一回実行
      void this.executeInitialRun(callback);
    } catch (error) {
      const message = 'スケジューラーの開始に失敗しました';
      Logger.error(message, error);
      throw new AppError(message, 'SCHEDULER_START_ERROR');
    }
  } /**
   * スケジューラーを停止
   */
  public stop(): void {
    try {
      if (!this.isRunning || !this.intervalId) {
        Logger.warn('⚠️ スケジューラーは実行されていません');
        return;
      }

      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;

      Logger.info('🛑 スケジューラーが停止されました');
      Logger.info(
        `📊 実行統計: 総実行回数=${this.totalExecutions}, 最終実行=${this.lastExecutionTime?.toLocaleString('ja-JP') ?? 'なし'}`
      );
    } catch (error) {
      Logger.error('スケジューラーの停止中にエラーが発生しました', error);
    }
  }

  /**
   * タスクを実行
   */
  private async executeTask(callback: () => Promise<void>): Promise<void> {
    const startTime = new Date();

    try {
      Logger.info(`🔄 定期タスクを実行中... (実行回数: ${this.totalExecutions + 1})`);

      await callback();

      this.lastExecutionTime = startTime;
      this.totalExecutions += 1;

      const duration = Date.now() - startTime.getTime();
      Logger.info(`✅ 定期タスクが完了しました (実行時間: ${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime.getTime();
      Logger.error(`❌ 定期タスク実行中にエラーが発生しました (実行時間: ${duration}ms)`, error);

      // エラーが発生してもスケジューラーは継続
    }
  }

  /**
   * 起動時の初回実行
   */
  private executeInitialRun(callback: () => Promise<void>): void {
    try {
      Logger.info('🚀 システム起動時の初回チェックを実行中...');

      // 少し待ってから実行（システムの初期化を待つ）
      setTimeout(() => {
        void this.executeTask(callback);
      }, 5000); // 5秒後に実行
    } catch (error) {
      Logger.error('初回実行中にエラーが発生しました', error);
    }
  } /**
   * スケジューラーの状態を取得
   */
  public getStatus(): {
    isRunning: boolean;
    intervalMinutes: number;
    lastExecutionTime: Date | null;
    totalExecutions: number;
    nextExecutionTime: Date | null;
  } {
    let nextExecutionTime = null;
    if (this.isRunning && this.lastExecutionTime) {
      nextExecutionTime = new Date(
        this.lastExecutionTime.getTime() +
          this.intervalMinutes * Scheduler.SECONDS_IN_MINUTE * Scheduler.MS_IN_SECOND
      );
    }

    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes,
      lastExecutionTime: this.lastExecutionTime,
      totalExecutions: this.totalExecutions,
      nextExecutionTime,
    };
  }

  /**
   * 手動でタスクを実行
   */
  public async executeManually(callback: () => Promise<void>): Promise<void> {
    try {
      Logger.info('🖱️ 手動タスク実行を開始...');
      await this.executeTask(callback);
    } catch (error) {
      Logger.error('手動タスク実行中にエラーが発生しました', error);
      throw error;
    }
  }

  /**
   * インターバル設定の妥当性を検証
   */
  public static validateInterval(minutes: number): boolean {
    return Number.isInteger(minutes) && minutes > 0 && minutes <= Scheduler.MINUTES_IN_DAY; // 1日以内
  }

  /**
   * インターバル設定の説明を取得
   */
  public static describeInterval(minutes: number): string {
    if (minutes < Scheduler.MINUTES_IN_HOUR) {
      return `${minutes}分間隔で実行`;
    } else if (minutes === Scheduler.MINUTES_IN_HOUR) {
      return '1時間間隔で実行';
    } else if (minutes % Scheduler.MINUTES_IN_HOUR === 0) {
      const hours = minutes / Scheduler.MINUTES_IN_HOUR;
      return `${hours}時間間隔で実行`;
    }
    const hours = Math.floor(minutes / Scheduler.MINUTES_IN_HOUR);
    const remainingMinutes = minutes % Scheduler.MINUTES_IN_HOUR;
    return `${hours}時間${remainingMinutes}分間隔で実行`;
  }
}
