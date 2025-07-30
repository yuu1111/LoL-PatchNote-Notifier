/**
 * Discord webhook notification service
 */

import { config } from '../config/index.js';
import {
  discordWebhookPayloadSchema,
  discordEmbedSchema,
} from '../config/schemas.js';
import { DISCORD_CONFIG, APP_CONFIG } from '../core/constants.js';
import { NotificationError, ValidationError } from '../core/errors.js';
import {
  type PatchInfo,
  type DiscordEmbed,
  type DiscordWebhookPayload,
  type NotificationResult,
} from '../core/types.js';
import { createContextLogger, logNotificationAttempt } from '../utils/logger.js';
import { httpClient } from '../utils/httpClient.js';

const logger = createContextLogger({ component: 'discordNotifier' });

/**
 * Discord notification service with rich embeds and error handling
 */
export class DiscordNotifier {
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = config.DISCORD_WEBHOOK_URL;

    logger.info('Discord notifier initialized', {
      webhookConfigured: !!this.webhookUrl,
      embedColor: DISCORD_CONFIG.EMBED_COLOR,
    });
  }

  /**
   * Send a notification for a new patch
   */
  async sendPatchNotification(patchInfo: PatchInfo): Promise<void> {
    const startTime = Date.now();
    const contextLogger = logger.child({
      operation: 'sendPatchNotification',
      patchTitle: patchInfo.title,
    });

    try {
      contextLogger.info('Preparing Discord notification', {
        title: patchInfo.title,
        url: patchInfo.url,
      });

      // Create Discord embed
      const embed = this.createPatchEmbed(patchInfo);

      // Create webhook payload
      const payload = this.createWebhookPayload(embed);

      // Validate payload
      this.validatePayload(payload);

      // Send notification
      contextLogger.info('Sending notification to Discord');
      const response = await httpClient.post(this.webhookUrl, payload, {
        timeout: DISCORD_CONFIG.WEBHOOK_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      logNotificationAttempt(true, {
        statusCode: response.status,
        responseTime,
        patchTitle: patchInfo.title,
      });

      contextLogger.info('Discord notification sent successfully', {
        statusCode: response.status,
        responseTime,
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;

      logNotificationAttempt(false, {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
        patchTitle: patchInfo.title,
      });

      contextLogger.error({ error }, 'Failed to send Discord notification');

      throw new NotificationError('Discord notification failed', {
        patchInfo,
        originalError: error,
      });
    }
  }

  /**
   * Send a notification with custom content
   */
  async sendCustomNotification(
    content: string,
    embeds?: DiscordEmbed[],
    options?: {
      username?: string;
      avatarUrl?: string;
    }
  ): Promise<void> {
    const startTime = Date.now();
    const contextLogger = logger.child({ operation: 'sendCustomNotification' });

    try {
      const payload: DiscordWebhookPayload = {
        content: this.validateAndTruncateContent(content),
        embeds: embeds?.map(embed => this.validateEmbed(embed)) ?? undefined,
        username: options?.username ?? undefined,
        avatar_url: options?.avatarUrl ?? undefined,
      };

      this.validatePayload(payload);

      contextLogger.info('Sending custom notification to Discord', {
        hasContent: !!payload.content,
        embedCount: payload.embeds?.length || 0,
      });

      const response = await httpClient.post(this.webhookUrl, payload, {
        timeout: DISCORD_CONFIG.WEBHOOK_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      logNotificationAttempt(true, {
        statusCode: response.status,
        responseTime,
        type: 'custom',
      });

      contextLogger.info('Custom notification sent successfully', {
        statusCode: response.status,
        responseTime,
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;

      logNotificationAttempt(false, {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
        type: 'custom',
      });

      contextLogger.error({ error }, 'Failed to send custom notification');

      throw new NotificationError('Custom Discord notification failed', {
        originalError: error,
      });
    }
  }

  /**
   * Send a test notification
   */
  async sendTestNotification(): Promise<NotificationResult> {
    const startTime = Date.now();
    const contextLogger = logger.child({ operation: 'sendTestNotification' });

    try {
      const testPatch: PatchInfo = {
        title: 'テスト パッチ ノート - Test Patch Notes',
        url: 'https://www.leagueoflegends.com/ja-jp/news/game-updates/',
        discoveredAt: new Date().toISOString(),
      };

      await this.sendPatchNotification(testPatch);

      const responseTime = Date.now() - startTime;

      contextLogger.info('Test notification completed successfully', { responseTime });

      return {
        success: true,
        responseTime,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      contextLogger.error({ error }, 'Test notification failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      };
    }
  }

  /**
   * Create a rich embed for patch notification
   */
  private createPatchEmbed(patchInfo: PatchInfo): DiscordEmbed {
    const embed: DiscordEmbed = {
      title: this.truncateText(patchInfo.title, DISCORD_CONFIG.MAX_TITLE_LENGTH),
      url: patchInfo.url,
      description: '新しいLeague of Legendsパッチノートが公開されました！詳細はこちらからご確認ください。',
      color: DISCORD_CONFIG.EMBED_COLOR,
      timestamp: new Date().toISOString(),
      footer: {
        text: `${APP_CONFIG.NAME} v${APP_CONFIG.VERSION}`,
      },
      thumbnail: {
        url: 'https://static.wikia.nocookie.net/leagueoflegends/images/1/12/League_of_Legends_Icon.png',
      },
    };

    return this.validateEmbed(embed);
  }

  /**
   * Create webhook payload with notification settings
   */
  private createWebhookPayload(embed: DiscordEmbed): DiscordWebhookPayload {
    const payload: DiscordWebhookPayload = {
      content: '@everyone 新しいパッチノートが公開されました！',
      embeds: [embed],
      username: APP_CONFIG.NAME,
    };

    return payload;
  }

  /**
   * Validate Discord embed against Discord limits
   */
  private validateEmbed(embed: DiscordEmbed): DiscordEmbed {
    try {
      return discordEmbedSchema.parse(embed);
    } catch (error) {
      logger.error({ error, embed }, 'Embed validation failed');
      throw new ValidationError('Discord embed validation failed', {
        embed,
        error,
      });
    }
  }

  /**
   * Validate webhook payload
   */
  private validatePayload(payload: DiscordWebhookPayload): void {
    try {
      discordWebhookPayloadSchema.parse(payload);
    } catch (error) {
      logger.error({ error, payload }, 'Webhook payload validation failed');
      throw new ValidationError('Discord webhook payload validation failed', {
        payload,
        error,
      });
    }
  }

  /**
   * Validate and truncate content to Discord limits
   */
  private validateAndTruncateContent(content: string): string {
    if (!content) {
      return '';
    }

    if (content.length > 2000) {
      logger.warn('Content truncated due to Discord limit', {
        originalLength: content.length,
        truncatedLength: 1997,
      });
      return content.substring(0, 1997) + '...';
    }

    return content;
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Test webhook connectivity
   */
  async testWebhookConnectivity(): Promise<{
    isConnected: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    const contextLogger = logger.child({ operation: 'testWebhookConnectivity' });

    try {
      // Send a minimal test payload
      const testPayload = {
        content: `🧪 ${APP_CONFIG.NAME} connectivity test - ${new Date().toISOString()}`,
        username: `${APP_CONFIG.NAME} Test`,
      };

      contextLogger.info('Testing webhook connectivity');

      const response = await httpClient.post(this.webhookUrl, testPayload, {
        timeout: DISCORD_CONFIG.WEBHOOK_TIMEOUT_MS,
      });

      const responseTime = Date.now() - startTime;

      contextLogger.info('Webhook connectivity test successful', {
        statusCode: response.status,
        responseTime,
      });

      return {
        isConnected: true,
        responseTime,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      contextLogger.warn({ error }, 'Webhook connectivity test failed');

      return {
        isConnected: false,
        error: errorMessage,
        responseTime,
      };
    }
  }

  /**
   * Get webhook information (without sensitive data)
   */
  getWebhookInfo(): {
    isConfigured: boolean;
    webhookId?: string | undefined;
    serverId?: string | undefined;
  } {
    if (!this.webhookUrl) {
      return { isConfigured: false };
    }

    try {
      // Extract webhook ID and server ID from URL (for diagnostics)
      const urlMatch = this.webhookUrl.match(/\/webhooks\/(\d+)\/[\w-]+/);
      if (urlMatch) {
        return {
          isConfigured: true,
          webhookId: urlMatch[1] ?? undefined,
        };
      }

      return { isConfigured: true };
    } catch {
      return { isConfigured: true };
    }
  }
}