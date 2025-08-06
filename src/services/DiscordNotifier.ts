/**
 * DiscordNotifier service
 * Handles sending notifications to Discord via webhook
 */

import fs from 'fs/promises';
import FormData from 'form-data';
import { httpClient } from '../utils/httpClient';
import { Logger } from '../utils/logger';
import { config } from '../config/config';
import {
  type DiscordEmbed,
  DiscordError,
  type DiscordWebhookPayload,
  type GeminiSummary,
  type PatchNote,
} from '../types/types';

export class DiscordNotifier {
  private readonly webhookUrl: string;

  // HTTP Status codes
  private static readonly HTTP_STATUS_OK_MIN = 200;
  private static readonly HTTP_STATUS_OK_MAX = 300;
  private static readonly HTTP_STATUS_INTERNAL_ERROR = 500;
  private static readonly HTTP_STATUS_RATE_LIMIT = 429;

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
    } catch (error: unknown) {
      const message = `Failed to send Discord notification for patch ${patchNote.version}`;
      Logger.error(message, error);

      if (error instanceof DiscordError) {
        throw error;
      }

      throw new DiscordError(
        message,
        error instanceof Error ? DiscordNotifier.HTTP_STATUS_INTERNAL_ERROR : undefined
      );
    }
  }

  /**
   * Setup local image attachment
   */
  private async setupLocalImage(
    patchNote: PatchNote,
    localImagePath?: string
  ): Promise<{ hasLocalImage: boolean; originalImageUrl?: string }> {
    if (!localImagePath) {
      return { hasLocalImage: false };
    }

    try {
      await fs.access(localImagePath);
      const originalImageUrl = patchNote.imageUrl;
      patchNote.imageUrl = `attachment://patch_${patchNote.version}.jpg`;
      Logger.info(`🖼️ ローカル画像をエンベッドに添付: ${localImagePath}`);
      return {
        hasLocalImage: true,
        ...(originalImageUrl && { originalImageUrl }),
      };
    } catch (error: unknown) {
      Logger.warn(`⚠️ ローカル画像アクセス失敗、オンライン画像を使用: ${String(error)}`);
      return { hasLocalImage: false };
    }
  }

  /**
   * Send webhook with attachment
   */
  private async sendWithAttachment(
    embed: DiscordEmbed,
    localImagePath: string,
    patchVersion: string
  ): Promise<void> {
    const formData = new FormData();
    const payload: DiscordWebhookPayload = {
      content: '🎮 **新しいパッチノートが公開されました！**',
      embeds: [embed],
    };

    formData.append('payload_json', JSON.stringify(payload));

    const imageBuffer = await fs.readFile(localImagePath);
    const filename = `patch_${patchVersion}.jpg`;
    formData.append('files[0]', imageBuffer, {
      filename,
      contentType: 'image/jpeg',
    });

    const response = await httpClient.post(this.webhookUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (
      response.status < DiscordNotifier.HTTP_STATUS_OK_MIN ||
      response.status >= DiscordNotifier.HTTP_STATUS_OK_MAX
    ) {
      throw new DiscordError(`Discord webhook failed: HTTP ${response.status}`, response.status);
    }

    Logger.info(`📎 エンベッド内にローカル画像を埋め込み送信完了: ${filename}`);
  }

  /**
   * Send webhook with JSON payload
   */
  private async sendWithJson(payload: DiscordWebhookPayload): Promise<void> {
    const response = await httpClient.post(this.webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (
      response.status < DiscordNotifier.HTTP_STATUS_OK_MIN ||
      response.status >= DiscordNotifier.HTTP_STATUS_OK_MAX
    ) {
      throw new DiscordError(`Discord webhook failed: HTTP ${response.status}`, response.status);
    }

    Logger.info(`📋 エンベッドメッセージを送信完了`);
  }

  /**
   * エンベッド内に画像を含めて送信
   */
  private async sendEmbedWithImage(
    patchNote: PatchNote,
    localImagePath?: string,
    summary?: GeminiSummary
  ): Promise<void> {
    const { hasLocalImage, originalImageUrl } = await this.setupLocalImage(
      patchNote,
      localImagePath
    );
    const embed = this.createPatchEmbed(patchNote, true, summary);

    // 元のimageUrlを復元
    if (originalImageUrl !== undefined) {
      patchNote.imageUrl = originalImageUrl;
    }

    if (hasLocalImage && localImagePath) {
      await this.sendWithAttachment(embed, localImagePath, patchNote.version);
    } else {
      const payload: DiscordWebhookPayload = {
        content: '🎮 **新しいパッチノートが公開されました！**',
        embeds: [embed],
      };
      await this.sendWithJson(payload);
    }
  }

  /**
   * Constants for Discord embed
   */
  private static readonly MAX_FIELD_LENGTH = 1021; // eslint-disable-line no-magic-numbers
  private static readonly COLOR_WITH_SUMMARY = 0x00ff99; // eslint-disable-line no-magic-numbers
  private static readonly COLOR_WITHOUT_SUMMARY = 0x0099ff; // eslint-disable-line no-magic-numbers

  /**
   * Create basic fields for patch embed
   */
  private createBasicFields(
    patchNote: PatchNote
  ): { name: string; value: string; inline?: boolean }[] {
    return [
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
  }

  /**
   * Truncate text if it exceeds max length
   */
  private truncateText(text: string, maxLength = DiscordNotifier.MAX_FIELD_LENGTH): string {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  }

  /**
   * Add summary field
   */
  private addSummaryField(
    fields: { name: string; value: string; inline?: boolean }[],
    summary: GeminiSummary
  ): void {
    if (summary.summary) {
      fields.push({
        name: '📝 AI要約',
        value: this.truncateText(summary.summary),
        inline: false,
      });
    }
  }

  /**
   * Add key changes field
   */
  private addKeyChangesField(
    fields: { name: string; value: string; inline?: boolean }[],
    keyChanges: string[]
  ): void {
    const changes = keyChanges.map((change, index) => `${index + 1}. ${change}`);
    const changesText = changes.join('\n\n');

    fields.push({
      name: '🎯 主要な変更点',
      value: this.truncateText(changesText),
      inline: false,
    });
  }

  /**
   * Add list field with specified name and emoji
   */
  private addListField(
    fields: { name: string; value: string; inline?: boolean }[],
    items: string[],
    name: string,
    maxItems = 3
  ): void {
    const text = items
      .slice(0, maxItems)
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n\n');

    fields.push({
      name,
      value: this.truncateText(text),
      inline: false,
    });
  }

  /**
   * Add all summary fields
   */
  private addAllSummaryFields(
    fields: { name: string; value: string; inline?: boolean }[],
    summary: GeminiSummary
  ): void {
    this.addSummaryField(fields, summary);

    if (summary.keyChanges.length > 0) {
      this.addKeyChangesField(fields, summary.keyChanges);
    }

    if (summary.newFeatures && summary.newFeatures.length > 0) {
      this.addListField(fields, summary.newFeatures, '✨ 新機能');
    }

    if (summary.importantBugFixes && summary.importantBugFixes.length > 0) {
      this.addListField(fields, summary.importantBugFixes, '🔧 重要なバグ修正');
    }

    if (summary.skinContent && summary.skinContent.length > 0) {
      this.addListField(fields, summary.skinContent, '🎨 スキン・コンテンツ');
    }

    // AIモデル情報を追加
    fields.push({
      name: '🤖 要約生成',
      value: `${summary.model} | ${new Date(summary.generatedAt).toLocaleString('ja-JP')}`,
      inline: true,
    });
  }

  /**
   * Create Discord embed for patch note
   */
  private createPatchEmbed(
    patchNote: PatchNote,
    includeImage = true,
    summary?: GeminiSummary
  ): DiscordEmbed {
    const fields = this.createBasicFields(patchNote);

    // Gemini要約がある場合は追加
    if (summary) {
      this.addAllSummaryFields(fields, summary);
    }

    const embed: DiscordEmbed = {
      title: patchNote.title,
      url: patchNote.url,
      color: summary ? DiscordNotifier.COLOR_WITH_SUMMARY : DiscordNotifier.COLOR_WITHOUT_SUMMARY,
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

      if (
        response.status < DiscordNotifier.HTTP_STATUS_OK_MIN ||
        response.status >= DiscordNotifier.HTTP_STATUS_OK_MAX
      ) {
        throw new DiscordError(
          `Test notification failed: HTTP ${response.status}`,
          response.status
        );
      }

      Logger.info('Test Discord notification sent successfully');
    } catch (error: unknown) {
      const message = 'Failed to send test Discord notification';
      Logger.error(message, error);
      throw new DiscordError(
        message,
        error instanceof Error ? DiscordNotifier.HTTP_STATUS_INTERNAL_ERROR : undefined
      );
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
