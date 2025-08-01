/**
 * StateManager service
 * JSONファイルベースの状態管理とパッチノート履歴管理
 */

import path from 'path';
import { FileStorage } from '../utils/fileStorage';
import { Logger } from '../utils/logger';
import { config } from '../config';
import { PatchNote, AppState, AppError } from '../types';

export class StateManager {
  private readonly stateFilePath: string;
  private readonly patchesDir: string;
  private currentState: AppState | null = null;

  constructor() {
    this.patchesDir = config.storage.patchesDir;
    this.stateFilePath = path.join(this.patchesDir, 'last_patch_status.json');
  }

  /**
   * アプリケーション状態を読み込み
   */
  public async loadState(): Promise<AppState> {
    try {
      Logger.debug(`状態ファイルを読み込み中: ${this.stateFilePath}`);

      const state = await FileStorage.readJson<AppState>(this.stateFilePath);

      if (state) {
        // 日付文字列を Date オブジェクトに変換
        if (state.lastCheckedPatch?.publishedAt) {
          state.lastCheckedPatch.publishedAt = new Date(state.lastCheckedPatch.publishedAt);
        }
        if (state.lastNotificationSent) {
          state.lastNotificationSent = new Date(state.lastNotificationSent);
        }

        this.currentState = state;
        Logger.info(
          `状態を正常に読み込み: 最終チェック=${state.lastCheckedPatch?.version ?? 'なし'}`
        );
        return state;
      }

      // 初期状態を作成
      const initialState: AppState = {
        totalNotificationsSent: 0,
        isRunning: false,
      };

      this.currentState = initialState;
      await this.saveState(initialState);
      Logger.info('初期状態を作成しました');
      return initialState;
    } catch (error) {
      const message = '状態の読み込みに失敗しました';
      Logger.error(message, error);
      throw new AppError(message, 'STATE_LOAD_ERROR');
    }
  }

  /**
   * アプリケーション状態を保存
   */
  public async saveState(state: AppState): Promise<void> {
    try {
      Logger.debug(`状態を保存中: ${this.stateFilePath}`);

      await FileStorage.writeJson(this.stateFilePath, state);
      this.currentState = state;

      Logger.debug('状態を正常に保存しました');
    } catch (error) {
      const message = '状態の保存に失敗しました';
      Logger.error(message, error);
      throw new AppError(message, 'STATE_SAVE_ERROR');
    }
  }

  /**
   * 新しいパッチノートが既に通知済みかチェック
   */
  public async isAlreadyNotified(patchNote: PatchNote): Promise<boolean> {
    const state = await this.loadState();

    if (!state.lastCheckedPatch) {
      Logger.debug('過去の通知履歴がありません - 新規パッチとして処理');
      return false;
    }

    const isSameVersion = state.lastCheckedPatch.version === patchNote.version;
    const isSameUrl = state.lastCheckedPatch.url === patchNote.url;

    Logger.debug(`通知済みチェック: バージョン=${isSameVersion}, URL=${isSameUrl}`);

    return isSameVersion && isSameUrl;
  } /**
   * パッチノート通知完了後の状態更新
   */
  public async markNotificationSent(patchNote: PatchNote): Promise<void> {
    try {
      const state = await this.loadState();

      // バージョン情報のみをlast_patch_status.jsonに保存
      state.lastCheckedPatch = {
        version: patchNote.version,
        title: patchNote.title,
        url: patchNote.url,
        publishedAt: patchNote.publishedAt,
      } as PatchNote;
      state.lastNotificationSent = new Date();
      state.totalNotificationsSent += 1;

      await this.saveState(state);

      Logger.info(
        `通知完了として記録: バージョン=${patchNote.version}, 総通知数=${state.totalNotificationsSent}`
      );
    } catch (error) {
      const message = '通知完了状態の更新に失敗しました';
      Logger.error(message, error);
      throw new AppError(message, 'STATE_UPDATE_ERROR');
    }
  }

  /**
   * アプリケーション実行状態を設定
   */
  public async setRunningState(isRunning: boolean): Promise<void> {
    try {
      const state = await this.loadState();
      state.isRunning = isRunning;
      await this.saveState(state);

      Logger.debug(`実行状態を更新: ${isRunning ? '動作中' : '停止中'}`);
    } catch (error) {
      Logger.error('実行状態の更新に失敗しました', error);
    }
  }

  /**
   * パッチノートの詳細データを保存
   */
  public async savePatchDetails(patchNote: PatchNote): Promise<void> {
    try {
      const sanitizedVersion = patchNote.version.replace(/[^a-zA-Z0-9.-]/g, '_');
      const patchDir = path.join(this.patchesDir, `patch_${sanitizedVersion}`);
      const jsonFilePath = path.join(patchDir, `patch_${sanitizedVersion}.json`);

      // パッチディレクトリを作成
      await FileStorage.ensureDirectoryPath(patchDir);

      const patchData = {
        ...patchNote,
        savedAt: new Date().toISOString(),
        metadata: {
          scraperVersion: '1.0.0',
          sourceUrl: config.lol.patchNotesUrl,
        },
      };

      await FileStorage.writeJson(jsonFilePath, patchData);

      Logger.debug(`パッチ詳細を保存: ${jsonFilePath}`);
    } catch (error) {
      Logger.error('パッチ詳細の保存に失敗しました', error);
      // 詳細保存の失敗は致命的ではないので例外を投げない
    }
  }

  /**
   * パッチノートの詳細データを読み込み
   */
  public async loadPatchDetails(version: string): Promise<PatchNote | null> {
    try {
      const sanitizedVersion = version.replace(/[^a-zA-Z0-9.-]/g, '_');
      const patchDir = path.join(this.patchesDir, `patch_${sanitizedVersion}`);
      const jsonFilePath = path.join(patchDir, `patch_${sanitizedVersion}.json`);

      const patchData = await FileStorage.readJson<Record<string, unknown>>(jsonFilePath);

      if (patchData) {
        // 日付文字列を Date オブジェクトに変換
        if (typeof patchData.publishedAt === 'string') {
          patchData.publishedAt = new Date(patchData.publishedAt);
        }

        Logger.debug(`パッチ詳細を読み込み: ${jsonFilePath}`);
        return patchData as PatchNote;
      }

      return null;
    } catch (error) {
      Logger.warn(`パッチ詳細の読み込みに失敗: ${version}`, error);
      return null;
    }
  }

  /**
   * パッチバージョンのディレクトリパスを取得
   */
  public getPatchDirectory(version: string): string {
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9.-]/g, '_');
    return path.join(this.patchesDir, `patch_${sanitizedVersion}`);
  } /**
   * 現在の状態を取得（メモリキャッシュから）
   */
  public getCurrentState(): AppState | null {
    return this.currentState;
  }

  /**
   * 状態の健全性チェック
   */
  public async validateState(): Promise<boolean> {
    try {
      const state = await this.loadState();

      // 基本的な整合性チェック
      if (state.totalNotificationsSent < 0) {
        Logger.warn('通知数が負の値です - 状態を修正中');
        state.totalNotificationsSent = 0;
        await this.saveState(state);
      }

      // 最終通知日時の妥当性チェック
      if (state.lastNotificationSent && state.lastNotificationSent > new Date()) {
        Logger.warn('最終通知日時が未来になっています - 状態を修正中');
        state.lastNotificationSent = new Date();
        await this.saveState(state);
      }

      Logger.debug('状態の健全性チェック完了');
      return true;
    } catch (error) {
      Logger.error('状態の健全性チェックに失敗しました', error);
      return false;
    }
  }

  /**
   * 古いパッチデータのクリーンアップ
   */
  public cleanupOldPatchData(maxAge: number = 90 * 24 * 60 * 60 * 1000): void {
    try {
      Logger.info('古いパッチデータのクリーンアップを開始');
      // 実装は将来のバージョンで追加
      Logger.debug(`${maxAge}ms より古いファイルをクリーンアップ対象とします`);
    } catch (error: unknown) {
      Logger.error('パッチデータのクリーンアップに失敗しました', error);
    }
  }

  /**
   * 状態ファイルのバックアップを作成
   */
  public async createBackup(): Promise<void> {
    try {
      if (!this.currentState) {
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.patchesDir, `state_backup_${timestamp}.json`);

      await FileStorage.writeJson(backupPath, this.currentState);
      Logger.debug(`状態バックアップを作成: ${backupPath}`);
    } catch (error) {
      Logger.error('状態バックアップの作成に失敗しました', error);
    }
  }
}
