/**
 * Gemini AI パッチノート要約サービス
 * パッチノート内容を分析し、分かりやすい日本語で要約する
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PatchNote, GeminiSummary } from '../types';
import { config } from '../config';
import { Logger } from '../utils/logger';
import { FileStorage } from '../utils/fileStorage';
import path from 'path';

export class GeminiSummarizer {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private readonly maxRetries: number;
  private readonly requestTimeout: number;

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
    } catch (error) {
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
        const result = await Promise.race([
          this.model.generateContent(prompt),
          this.createTimeoutPromise(),
        ]);

        const response = await result.response;
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
1. **正確性**: 全ての変更内容を漏らさず含める
2. **分かりやすさ**: 専門用語は説明を加え、一般プレイヤーにも理解しやすくする
3. **構造化**: 主要な変更点を優先度順に整理する
4. **簡潔性**: 重要な情報を効率的にまとめる

## 出力形式：
以下のJSON形式で応答してください：

\`\`\`json
{
  "summary": "パッチ全体の概要を2-3文で簡潔に説明",
  "keyChanges": [
    "重要な変更点1（チャンピオン調整、新機能、バランス変更など）",
    "重要な変更点2",
    "重要な変更点3",
    "その他の重要な変更..."
  ]
}
\`\`\`

## パッチノート内容：
タイトル: ${patchNote.title}
URL: ${patchNote.url}

内容:
${patchNote.content}

上記の内容を分析し、日本のLoLプレイヤーにとって最も有用で分かりやすい要約を作成してください。
`;
  }

  /**
   * Geminiのレスポンスを解析してGeminiSummary形式に変換
   */
  private parseSummaryResponse(response: string, version: string): GeminiSummary {
    try {
      // JSONブロックを抽出
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        const jsonData = JSON.parse(jsonMatch[1]);
        return {
          version,
          summary: jsonData.summary || '',
          keyChanges: jsonData.keyChanges || [],
          generatedAt: new Date(),
          model: config.gemini.model,
        };
      }

      // JSONブロックが見つからない場合、直接JSONとして解析を試行
      const jsonData = JSON.parse(response);
      return {
        version,
        summary: jsonData.summary || '',
        keyChanges: jsonData.keyChanges || [],
        generatedAt: new Date(),
        model: config.gemini.model,
      };
    } catch (error) {
      Logger.warn(`Geminiレスポンスの解析に失敗、フォールバック処理実行: ${error}`);

      // パースに失敗した場合のフォールバック
      return {
        version,
        summary: response.substring(0, 500) + '...', // 最初の500文字を使用
        keyChanges: ['詳細は元のパッチノートをご確認ください'],
        generatedAt: new Date(),
        model: config.gemini.model,
      };
    }
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
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7日間

      if (cacheAge > maxAge) {
        Logger.info(`キャッシュが期限切れです: ${version}`);
        return null;
      }

      return cachedData;
    } catch (error) {
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
    } catch (error) {
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
        // 全キャッシュ削除
        const fs = await import('fs/promises');
        if (await FileStorage.exists(config.storage.summariesDir)) {
          const files = await fs.readdir(config.storage.summariesDir);
          for (const file of files) {
            if (file.startsWith('summary-') && file.endsWith('.json')) {
              await FileStorage.delete(path.join(config.storage.summariesDir, file));
            }
          }
          Logger.info('全ての要約キャッシュを削除しました');
        }
      }
    } catch (error) {
      Logger.error('要約キャッシュ削除エラー:', error);
    }
  }
}
