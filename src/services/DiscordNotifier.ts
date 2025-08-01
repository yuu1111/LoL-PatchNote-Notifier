/**
 * DiscordNotifier service
 * Handles sending notifications to Discord via webhook
 */

import fs from 'fs/promises';
import FormData from 'form-data';
import { httpClient } from '../utils/httpClient';
import { Logger } from '../utils/logger';
import { config } from '../config';
import {
  PatchNote,
  DiscordWebhookPayload,
  DiscordEmbed,
  DiscordError,
  GeminiSummary,
} from '../types';

export class DiscordNotifier {
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = config.discord.webhookUrl;
  }

  /**
   * Send patch notification to Discord (エンベッド内画像表示)
   */
  public async sendPatchNotification(
    patchNote: PatchNote,
    localImagePath?: string,
    summary?: GeminiSummary
  ): Promise<void> {
    try {
      Logger.info(`Sending Discord notification for patch: ${patchNote.title}`);

      // エンベッド内に画像を含めて送信
      await this.sendEmbedWithImage(patchNote, localImagePath, summary);

      Logger.info(`✅ Discord通知が完了しました: ${patchNote.version}`);
    } catch (error) {
      const message = `Failed to send Discord notification for patch ${patchNote.version}`;
      Logger.error(message, error);

      if (error instanceof DiscordError) {
        throw error;
      }

      throw new DiscordError(message, error instanceof Error ? 500 : undefined);
    }
  }

  /**
   * エンベッド内に画像を含めて送信
   */
  private async sendEmbedWithImage(
    patchNote: PatchNote,
    localImagePath?: string,
    summary?: GeminiSummary
  ): Promise<void> {
    // ローカル画像があれば、一時的にURLとして設定（後でattachment://で参照）
    let imageUrl = patchNote.imageUrl;
    let hasLocalImage = false;

    if (localImagePath) {
      try {
        await fs.access(localImagePath);
        imageUrl = `attachment://patch_${patchNote.version}.jpg`;
        hasLocalImage = true;
        Logger.info(`🖼️ ローカル画像をエンベッドに添付: ${localImagePath}`);
      } catch (error) {
        Logger.warn(`⚠️ ローカル画像アクセス失敗、オンライン画像を使用: ${error}`);
      }
    }

    // 一時的にpatchNoteのimageUrlを更新してエンベッドを作成
    const originalImageUrl = patchNote.imageUrl;
    if (hasLocalImage && imageUrl) {
      patchNote.imageUrl = imageUrl;
    }

    const embed = this.createPatchEmbed(patchNote, true, summary); // 画像URLと要約を含める

    // 元のimageUrlを復元
    if (originalImageUrl !== undefined) {
      patchNote.imageUrl = originalImageUrl;
    }

    const payload: DiscordWebhookPayload = {
      content: '🎮 **新しいパッチノートが公開されました！**',
      embeds: [embed],
    };

    if (hasLocalImage && localImagePath) {
      // 添付ファイル付きで送信
      const formData = new FormData();

      // JSONペイロードをフォームデータに追加
      formData.append('payload_json', JSON.stringify(payload));

      // 画像ファイルを添付
      const imageBuffer = await fs.readFile(localImagePath);
      const filename = `patch_${patchNote.version}.jpg`;
      formData.append('files[0]', imageBuffer, {
        filename,
        contentType: 'image/jpeg',
      });

      const response = await httpClient.post(this.webhookUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new DiscordError(`Discord webhook failed: HTTP ${response.status}`, response.status);
      }

      Logger.info(`📎 エンベッド内にローカル画像を埋め込み送信完了: ${filename}`);
    } else {
      // 通常のJSON送信（オンライン画像またはデフォルト画像）
      const response = await httpClient.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new DiscordError(
          `Discord embed message failed: HTTP ${response.status}`,
          response.status
        );
      }

      Logger.info(`📋 エンベッドメッセージを送信完了`);
    }
  }

  /**
   * Create Discord embed for patch note
   */
  private createPatchEmbed(
    patchNote: PatchNote,
    includeImage = true,
    summary?: GeminiSummary
  ): DiscordEmbed {
    const fields = [
      {
        name: '📋 バージョン',
        value: patchNote.version,
        inline: true,
      },
      {
        name: '🔗 リンク',
        value: `[パッチノートを読む](${patchNote.url})`,
        inline: true,
      },
    ];

    // Gemini要約がある場合は追加
    if (summary) {
      // 要約を追加
      if (summary.summary) {
        fields.push({
          name: '📝 AI要約',
          value:
            summary.summary.length > 1024
              ? `${summary.summary.substring(0, 1021)}...`
              : summary.summary,
          inline: false,
        });
      }

      // 主要な変更点を追加（最大5つまで）
      if (summary.keyChanges && summary.keyChanges.length > 0) {
        const changes = summary.keyChanges
          .slice(0, 5)
          .map((change, index) => `${index + 1}. ${change}`);
        const changesText = changes.join('\n');

        fields.push({
          name: '🎯 主要な変更点',
          value: changesText.length > 1024 ? `${changesText.substring(0, 1021)}...` : changesText,
          inline: false,
        });
      }

      // AIモデル情報を追加
      fields.push({
        name: '🤖 要約生成',
        value: `${summary.model} | ${new Date(summary.generatedAt).toLocaleString('ja-JP')}`,
        inline: true,
      });
    }

    const embed: DiscordEmbed = {
      title: patchNote.title,
      url: patchNote.url,
      color: summary ? 0x00ff99 : 0x0099ff, // 要約がある場合は緑系、ない場合は青系
      timestamp: patchNote.publishedAt.toISOString(),
      footer: {
        text: summary
          ? 'League of Legends Patch Notifier | AI要約付き'
          : 'League of Legends Patch Notifier',
      },
      fields,
    };

    // Add image if available and requested
    if (includeImage && patchNote.imageUrl) {
      embed.image = {
        url: patchNote.imageUrl,
      };
    }

    return embed;
  } /**
   * Send a test notification to verify webhook configuration
   */
  public async sendTestNotification(): Promise<void> {
    try {
      Logger.info('Sending test Discord notification...');

      const testEmbed: DiscordEmbed = {
        title: '🧪 テスト通知',
        description: 'LoL Patch Notifier が正常に動作しています！',
        color: 0x00ff00, // Green color
        timestamp: new Date().toISOString(),
        footer: {
          text: 'League of Legends Patch Notifier - Test',
        },
      };

      const payload: DiscordWebhookPayload = {
        content: '✅ **システムテスト**',
        embeds: [testEmbed],
      };

      const response = await httpClient.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new DiscordError(
          `Test notification failed: HTTP ${response.status}`,
          response.status
        );
      }

      Logger.info('Test Discord notification sent successfully');
    } catch (error) {
      const message = 'Failed to send test Discord notification';
      Logger.error(message, error);
      throw new DiscordError(message, error instanceof Error ? 500 : undefined);
    }
  }

  /**
   * Validate webhook URL format
   */
  public static validateWebhookUrl(url: string): boolean {
    const webhookPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    return webhookPattern.test(url);
  }

  /**
   * Send error notification to Discord (for system monitoring)
   */
  public async sendErrorNotification(error: Error, context?: string): Promise<void> {
    try {
      Logger.info('Sending error notification to Discord...');

      const errorEmbed: DiscordEmbed = {
        title: '❌ システムエラー',
        description: `エラーが発生しました: ${error.message}`,
        color: 0xff0000, // Red color
        timestamp: new Date().toISOString(),
        footer: {
          text: 'League of Legends Patch Notifier - Error',
        },
        ...(context && {
          fields: [
            {
              name: '📍 コンテキスト',
              value: context,
              inline: false,
            },
          ],
        }),
      };

      const payload: DiscordWebhookPayload = {
        content: '🚨 **システムアラート**',
        embeds: [errorEmbed],
      };

      await httpClient.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      Logger.debug('Error notification sent to Discord');
    } catch (notificationError) {
      // Don't throw here to avoid recursive errors
      Logger.error('Failed to send error notification to Discord', notificationError);
    }
  }
}
