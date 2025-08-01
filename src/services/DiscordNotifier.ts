/**
 * DiscordNotifier service
 * Handles sending notifications to Discord via webhook
 */

import fs from 'fs/promises';
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
   * Send patch notification to Discord
   */
  public async sendPatchNotification(patchNote: PatchNote, localImagePath?: string): Promise<void> {
    try {
      Logger.info(`Sending Discord notification for patch: ${patchNote.title}`);

      const embed = this.createPatchEmbed(patchNote);
      const payload: DiscordWebhookPayload = {
        content: '🎮 **新しいパッチノートが公開されました！**',
        embeds: [embed],
      };

      // Send webhook request
      const response = await httpClient.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });      if (response.status < 200 || response.status >= 300) {
        throw new DiscordError(`Discord webhook failed: HTTP ${response.status}`, response.status);
      }

      Logger.info(`Successfully sent Discord notification for patch ${patchNote.version}`);
      
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
   * Create Discord embed for patch note
   */
  private createPatchEmbed(patchNote: PatchNote): DiscordEmbed {
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

    // Add image if available
    if (patchNote.imageUrl) {
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