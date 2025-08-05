/**
 * Gemini AI パッチノート要約サービス
 * パッチノート内容を分析し、分かりやすい日本語で要約する
 */

import { type GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiResult, GeminiSummary, PatchNote } from '../types';
import { config } from '../config';
import { Logger } from '../utils/logger';
import { FileStorage } from '../utils/fileStorage';
import path from 'path';

export class GeminiSummarizer {
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;
  private readonly maxRetries: number;
  private readonly requestTimeout: number;

  // Time constants
  private static readonly DAYS_IN_WEEK = 7; // eslint-disable-line no-magic-numbers
  private static readonly HOURS_IN_DAY = 24; // eslint-disable-line no-magic-numbers
  private static readonly MINUTES_IN_HOUR = 60; // eslint-disable-line no-magic-numbers
  private static readonly SECONDS_IN_MINUTE = 60; // eslint-disable-line no-magic-numbers
  private static readonly MS_IN_SECOND = 1000;
  private static readonly CACHE_MAX_AGE_DAYS = 7; // eslint-disable-line no-magic-numbers

  constructor() {
    this.maxRetries = config.gemini.maxRetries;
    this.requestTimeout = config.gemini.timeout;

    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.gemini.model,
      generationConfig: {
        temperature: config.gemini.temperature,
        maxOutputTokens: config.gemini.maxTokens,
      },
    });
  }

  /**
   * パッチノートの要約を生成またはキャッシュから取得
   */
  async generateSummary(patchNote: PatchNote): Promise<GeminiSummary | null> {
    try {
      // キャッシュから要約を取得を試行
      const cachedSummary = await this.getCachedSummary(patchNote.version);
      if (cachedSummary) {
        Logger.info(`キャッシュされた要約を使用: ${patchNote.version}`);
        return cachedSummary;
      }

      // パッチノートのコンテンツが必要
      if (!patchNote.content) {
        Logger.warn(`パッチノートのコンテンツが空です: ${patchNote.version}`);
        return null;
      }

      Logger.info(`Gemini APIでパッチノート要約を生成中: ${patchNote.version}`);
      Logger.info(
        `⏳ 要約生成開始 - 最大${this.requestTimeout}ms, 最大${this.maxRetries}回リトライ`
      );

      const prompt = this.createSummaryPrompt(patchNote);
      const startTime = Date.now();
      const text = await this.generateContentWithRetry(prompt, patchNote.version);
      const duration = Date.now() - startTime;

      Logger.info(`⚡ 要約生成完了 - 処理時間: ${duration}ms`);

      // レスポンスを解析
      const summary = this.parseSummaryResponse(text, patchNote.version);

      // 要約をキャッシュに保存
      await this.cacheSummary(summary);

      Logger.info(`パッチノート要約を生成完了: ${patchNote.version}`);
      return summary;
    } catch (error: unknown) {
      Logger.error(`Gemini要約生成エラー (${patchNote.version}):`, error);
      return null;
    }
  }

  /**
   * リトライ機能付きでGemini APIにリクエストを送信
   */
  private async generateContentWithRetry(prompt: string, version: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        Logger.info(`Gemini API呼び出し試行 ${attempt}/${this.maxRetries} (${version})`);

        // タイムアウト付きでAPI呼び出し
        const result = (await Promise.race([
          this.model.generateContent(prompt),
          this.createTimeoutPromise(),
        ])) as GeminiResult;

        const { response } = result;
        const text = response.text();

        if (!text || text.trim().length === 0) {
          throw new Error('Gemini APIから空のレスポンスが返されました');
        }

        Logger.info(`Gemini API呼び出し成功 (${version}): ${text.length}文字`);
        return text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        Logger.warn(
          `Gemini API呼び出し失敗 試行${attempt}/${this.maxRetries} (${version}): ${lastError.message}`
        );

        // 最後の試行でない場合は待機
        if (attempt < this.maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 指数バックオフ (2s, 4s, 8s)
          Logger.info(`${waitTime}ms待機してリトライします...`);
          await this.delay(waitTime);
        }
      }
    }

    // 全ての試行が失敗した場合
    throw new Error(
      `Gemini API呼び出しが${this.maxRetries}回とも失敗しました: ${lastError?.message}`
    );
  }

  /**
   * タイムアウト用のPromiseを作成
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini APIタイムアウト (${this.requestTimeout}ms)`));
      }, this.requestTimeout);
    });
  }

  /**
   * 指定された時間だけ待機
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 要約生成用のプロンプトを作成
   */
  private createSummaryPrompt(patchNote: PatchNote): string {
    return `
League of Legends パッチノート ${patchNote.version} の内容を分析し、日本語で分かりやすく要約してください。

## 要求事項：
1. **重要度重視**: 以下の主要要素に集中し、質の高い要約を生成
   - 新機能・大規模システム変更（ゲームプレイに大きな影響を与えるもの）
   - 主要チャンピオン調整（メタに影響する重要な変更のみ）
   - 重要なアイテム変更（ビルドやプレイスタイルに影響するもの）
   - クリティカルなバグ修正（ゲームプレイに深刻な影響があったもの）
2. **品質重視**: 些細な変更は省略し、プレイヤーにとって本当に重要な情報のみを含める
3. **分かりやすさ**: 新システムや複雑な計算式には説明を加える。ただし以下は説明不要：
   - サモナースペル（スマイト、フラッシュ、イグナイト等）
   - 基本用語（ガンク、ロール、レーン、CS、バロン、ドラゴン等）
   - チャンピオン名、アイテム名
   - 基本ステータス（AD、AP、HP、マナ等）
4. **影響度評価**: 各変更がゲームプレイやメタに与える実際の影響を重視

## keyChanges選別基準：
重要な変更を種類に関係なく影響度順に3〜5個選択：
- **チャンピオン**: サモナーズリフトでのメタに影響する大規模調整（ARAM、アリーナ、イベントモードは除外）
- **アイテム**: ビルドパスやゲームプレイに大きく影響する変更、または面白い・興味深い変更
- **システム**: 新機能や既存システムの大幅変更
- **バグ修正**: 競技性やゲームプレイに影響していた重要な修正（積極的に1〜3個含める）
- **その他**: プレイヤーにとって重要な全ての変更
- 微細な数値調整や小規模な修正は省略し、本当に重要な変更のみを厳選する

## 出力形式：
以下のJSON形式で応答してください。**重要でない項目は空配列で返す**：

\`\`\`json
{
  "summary": "パッチの核心となる変更を2-3文で簡潔に説明",
  "keyChanges": [
    "最も重要な変更点1（メタやゲームプレイへの影響が大きいもの）",
    "最も重要な変更点2",
    "最も重要な変更点3（必要に応じて4〜5個まで）"
  ],
  "newFeatures": [
    "ゲームプレイに影響する新機能のみ"
  ],
  "importantBugFixes": [
    "競技性やゲームプレイに影響していた重要なバグ修正（1〜3個程度）"
  ],
  "skinContent": [
    "新スキン情報",
    "ショップ更新情報"
  ]
}
\`\`\`

**注意事項**:
- 本当に重要な変更とスキン・コンテンツ情報のみに集中してください
- 「〇〇アイテム恩恵チャンピオンの調整」のような無理やりの分類は避けてください
- 各チャンピオンの調整は独立した変更として扱ってください
- 関連性があっても異なる変更は別々の項目にしてください

## パッチノート内容：
タイトル: ${patchNote.title}
URL: ${patchNote.url}

内容:
${patchNote.content}

## 分析方法：
1. **系統的読み込み**: パッチノート全体を順序立てて分析
2. **重要度判定**: 各変更のメタやゲームプレイへの影響度を評価
3. **keyChanges重視**: 最も重要な3〜5つの変更点にチャンピオン、アイテム、システム変更を統合
4. **影響評価**: 各変更がゲームプレイに与える実際の影響を分析

keyChangesには、チャンピオンの重要な調整、アイテムの大きな変更、新機能、システム変更を区別なく含めて、パッチ全体で最も重要な3〜5つの変更として整理してください。

**重要**:
- 無理やり項目数を合わせる必要はありません
- 関連のない複数の変更を1つの項目にまとめてはいけません
- 実際に独立した変更は個別の項目として扱ってください
- アイテム関連として無理やりチャンピオン調整をまとめないでください

重要なバグ修正は積極的に1〜3個含めて、プレイヤーが知っておくべき修正内容を明確に伝えてください。日本のLoLプレイヤーにとって最も有用で分かりやすい要約を作成してください。
`;
  }

  /**
   * Geminiのレスポンスを解析してGeminiSummary形式に変換
   */
  private parseSummaryResponse(response: string, version: string): GeminiSummary {
    try {
      const jsonData = this.extractJsonFromResponse(response);
      return this.buildGeminiSummary(jsonData, version);
    } catch (error: unknown) {
      Logger.warn(`Geminiレスポンスの解析に失敗、フォールバック処理実行: ${String(error)}`);
      return this.createFallbackSummary(response, version);
    }
  }

  /**
   * レスポンスからJSONデータを抽出
   */
  private extractJsonFromResponse(response: string): Record<string, unknown> {
    // JSONブロックを抽出
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch?.[1]) {
      return JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    }

    // JSONブロックが見つからない場合、直接JSONとして解析を試行
    return JSON.parse(response) as Record<string, unknown>;
  }

  /**
   * JSONデータからGeminiSummaryを構築
   */
  private buildGeminiSummary(jsonData: Record<string, unknown>, version: string): GeminiSummary {
    return {
      version,
      summary: typeof jsonData.summary === 'string' ? jsonData.summary : '',
      keyChanges: this.filterStringArray(jsonData.keyChanges, []),
      newFeatures: this.filterStringArray(jsonData.newFeatures, []),
      importantBugFixes: this.filterStringArray(jsonData.importantBugFixes, []),
      skinContent: this.filterStringArray(jsonData.skinContent, []),
      generatedAt: new Date(),
      model: config.gemini.model,
    };
  }

  /**
   * 配列から文字列のみをフィルタリング
   */
  private filterStringArray(data: unknown, fallback: string[]): string[] {
    return Array.isArray(data)
      ? data.filter((item): item is string => typeof item === 'string')
      : fallback;
  }

  /**
   * フォールバック用のサマリーを作成
   */
  private createFallbackSummary(response: string, version: string): GeminiSummary {
    const maxSummaryLength = 500;
    return {
      version,
      summary: `${response.substring(0, maxSummaryLength)}...`,
      keyChanges: ['詳細は元のパッチノートをご確認ください'],
      generatedAt: new Date(),
      model: config.gemini.model,
    };
  }

  /**
   * キャッシュされた要約を取得
   */
  async getCachedSummary(version: string): Promise<GeminiSummary | null> {
    try {
      const summaryPath = this.getSummaryFilePath(version);

      if (!(await FileStorage.exists(summaryPath))) {
        return null;
      }

      const cachedData = await FileStorage.readJson<GeminiSummary>(summaryPath);

      if (!cachedData) {
        return null;
      }

      // キャッシュの有効性を確認（7日間有効）
      const cacheAge = Date.now() - new Date(cachedData.generatedAt).getTime();
      const maxAge =
        GeminiSummarizer.CACHE_MAX_AGE_DAYS *
        GeminiSummarizer.HOURS_IN_DAY *
        GeminiSummarizer.MINUTES_IN_HOUR *
        GeminiSummarizer.SECONDS_IN_MINUTE *
        GeminiSummarizer.MS_IN_SECOND;

      if (cacheAge > maxAge) {
        Logger.info(`キャッシュが期限切れです: ${version}`);
        return null;
      }

      return cachedData;
    } catch (error: unknown) {
      Logger.warn(`キャッシュ読み込みエラー (${version}):`, error);
      return null;
    }
  }

  /**
   * 要約をキャッシュに保存
   */
  async cacheSummary(summary: GeminiSummary): Promise<void> {
    try {
      const summaryPath = this.getSummaryFilePath(summary.version);
      const summaryDir = path.dirname(summaryPath);

      // パッチディレクトリを確実に作成
      await FileStorage.ensureDirectoryPath(summaryDir);

      await FileStorage.writeJson(summaryPath, summary);
      Logger.info(`要約をキャッシュに保存: ${summaryPath}`);
    } catch (error: unknown) {
      Logger.error(`要約キャッシュ保存エラー (${summary.version}):`, error);
    }
  }

  /**
   * 要約ファイルのパスを取得
   */
  private getSummaryFilePath(version: string): string {
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9.-]/g, '_');
    const patchDir = path.join(config.storage.patchesDir, `patch_${sanitizedVersion}`);
    const filename = `patch_${sanitizedVersion}_summary.json`;
    return path.join(patchDir, filename);
  }

  /**
   * キャッシュされた要約を削除
   */
  async clearCache(version?: string): Promise<void> {
    try {
      if (version) {
        const summaryPath = this.getSummaryFilePath(version);
        if (await FileStorage.exists(summaryPath)) {
          await FileStorage.delete(summaryPath);
          Logger.info(`要約キャッシュを削除: ${version}`);
        }
      } else {
        await this.deleteAllCaches();
      }
    } catch (error: unknown) {
      Logger.error('要約キャッシュ削除エラー:', error);
    }
  }

  /**
   * 全キャッシュを削除
   */
  private async deleteAllCaches(): Promise<void> {
    const fs = await import('fs/promises');
    if (!(await FileStorage.exists(config.storage.summariesDir))) {
      return;
    }

    const files = await fs.readdir(config.storage.summariesDir);
    for (const file of files) {
      if (file.startsWith('summary-') && file.endsWith('.json')) {
        await FileStorage.delete(path.join(config.storage.summariesDir, file));
      }
    }
    Logger.info('全ての要約キャッシュを削除しました');
  }
}
