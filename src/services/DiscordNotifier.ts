/**
 * DiscordNotifier service
 * Handles sending notifications to Discord via webhook
 */

import fs from 'fs/promises';
import FormData from 'form-data';
import { httpClient } from '../utils/httpClient';
import { Logger } from '../utils/logger';
import { config } from '../config';
import { PatchNote, DiscordWebhookPayload, DiscordEmbed, DiscordError } from '../types';

export class DiscordNotifier {
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = config.discord.webhookUrl;
  }

  /**
   * Send patch notification to Discord (2段階送信: エンベッド → 画像)
   */
  public async sendPatchNotification(patchNote: PatchNote, localImagePath?: string): Promise<void> {
    try {
      Logger.info(`Sending Discord notification for patch: ${patchNote.title}`);

      // Step 1: エンベッド情報を先に送信
      await this.sendEmbedMessage(patchNote);
      Logger.info(`📋 エンベッド情報を送信完了: ${patchNote.version}`);

      // Step 2: 画像が利用可能な場合は別途送信
      if (localImagePath) {
        try {
          // 少し間隔を空けて自然な順序で表示されるようにする
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          await this.sendImageOnly(localImagePath, patchNote.version);
          Logger.info(`🖼️ パッチ画像を追加送信完了: ${patchNote.version}`);
        } catch (imageError) {
          Logger.warn(`⚠️ パッチ画像の送信に失敗しましたが、エンベッドは送信済み: ${imageError}`);
        }
      }

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
   * エンベッドメッセージのみを送信
   */
  private async sendEmbedMessage(patchNote: PatchNote): Promise<void> {
    const embed = this.createPatchEmbed(patchNote, false); // 画像URLは含めない
    const payload: DiscordWebhookPayload = {
      content: '🎮 **新しいパッチノートが公開されました！**',
      embeds: [embed],
    };

    const response = await httpClient.post(this.webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new DiscordError(`Discord embed message failed: HTTP ${response.status}`, response.status);
    }
  }

  /**
   * 画像のみを単独で送信
   */
  private async sendImageOnly(localImagePath: string, version: string): Promise<void> {
    try {
      // ファイルの存在確認
      await fs.access(localImagePath);
      
      const formData = new FormData();
      
      // 画像ファイルを添付（コンテンツやエンベッドなし）
      const imageBuffer = await fs.readFile(localImagePath);
      const filename = `patch_${version}.jpg`;
      formData.append('files[0]', imageBuffer, {
        filename,
        contentType: 'image/jpeg'
      });

      // 画像のみを送信
      const response = await httpClient.post(this.webhookUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new DiscordError(`Discord image upload failed: HTTP ${response.status}`, response.status);
      }

    } catch (error) {
      Logger.error(`画像送信エラー: ${error}`);
      throw error;
    }
  }

  /**
   * 添付ファイル付きでDiscord通知を送信（レガシー）
   */
  private async sendWithAttachment(patchNote: PatchNote, localImagePath: string): Promise<void> {
    try {
      // ファイルの存在確認
      await fs.access(localImagePath);

      const formData = new FormData();
      const embed = this.createPatchEmbed(patchNote, false); // 画像URLは含めない

      const payload: DiscordWebhookPayload = {
        content: '🎮 **新しいパッチノートが公開されました！**',
        embeds: [embed],
      };

      // JSONペイロードをフォームデータに追加
      formData.append('payload_json', JSON.stringify(payload));

      // 画像ファイルを添付
      const imageBuffer = await fs.readFile(localImagePath);
      const filename = `patch_${patchNote.version}.jpg`;
      formData.append('files[0]', imageBuffer, {
        filename,
        contentType: 'image/jpeg'
      });

      // multipart/form-dataでリクエスト送信
      const response = await httpClient.post(this.webhookUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new DiscordError(`Discord webhook failed: HTTP ${response.status}`, response.status);
      }

      Logger.info(`📎 パッチ画像を添付ファイルとして送信しました: ${filename}`);

    } catch (error) {
      Logger.warn(`⚠️ 添付ファイル送信に失敗、通常送信にフォールバック: ${error}`);
      // 添付ファイル送信に失敗した場合は通常送信にフォールバック
      await this.sendWithoutAttachment(patchNote);
    }
  }

  /**
   * 添付ファイルなしでDiscord通知を送信
   */
  private async sendWithoutAttachment(patchNote: PatchNote): Promise<void> {
    const embed = this.createPatchEmbed(patchNote, true); // エンベッド画像を含める
    const payload: DiscordWebhookPayload = {
      content: '🎮 **新しいパッチノートが公開されました！**',
      embeds: [embed],
    };

    const response = await httpClient.post(this.webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new DiscordError(`Discord webhook failed: HTTP ${response.status}`, response.status);
    }
  }

  /**
   * Create Discord embed for patch note
   */
  private createPatchEmbed(patchNote: PatchNote, includeImage: boolean = true): DiscordEmbed {
    const embed: DiscordEmbed = {
      title: patchNote.title,
      url: patchNote.url,
      color: 0x0099ff, // Blue color
      timestamp: patchNote.publishedAt.toISOString(),
      footer: {
        text: 'League of Legends Patch Notifier',
      },
      fields: [
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
      ],
    };

    // Add image if available and requested
    if (includeImage && patchNote.imageUrl) {
      embed.image = {
        url: patchNote.imageUrl,
      };
    }

    return embed;
  }  /**
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
        throw new DiscordError(`Test notification failed: HTTP ${response.status}`, response.status);
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