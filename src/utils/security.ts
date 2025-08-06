/**
 * セキュリティユーティリティ - データ保護・機密情報のマスキング
 * LoL Patch Notifier用セキュリティ機能
 */

// Constants
const EMAIL_PREFIX_LENGTH = 2;
const DISCORD_ID_MIN_LENGTH = 8;
const DISCORD_ID_PREFIX_LENGTH = 4;
const DISCORD_ID_SUFFIX_LENGTH = 4;
const MIN_SECURE_KEY_LENGTH = 32;

/**
 * 機密情報をマスキングするための設定
 */
const SENSITIVE_PATTERNS = {
  // APIキー・トークン
  apiKeys: [
    /AIza[0-9A-Za-z_-]{35}/g, // Google API Key
    /sk-[a-zA-Z0-9]{48}/g, // OpenAI API Key
    /Bot\s+[A-Za-z0-9._-]{59}/g, // Discord Bot Token
  ],
  // Webhook URLs
  webhooks: [
    /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g, // Discord Webhook
  ],
  // 個人情報
  personalInfo: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{3}-\d{4}-\d{4}\b/g, // Phone numbers (Japan format)
    /\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/g, // Credit card numbers
  ],
  // Discord IDs（完全マスクではなく部分マスク）
  discordIds: [
    /\b\d{17,19}\b/g, // Discord Snowflake IDs
  ],
};

/**
 * マスキングオプションのインターフェース
 */
interface MaskOptions {
  maskApiKeys?: boolean;
  maskWebhooks?: boolean;
  maskPersonalInfo?: boolean;
  maskDiscordIds?: boolean;
  preserveLength?: boolean;
}

/**
 * 機密情報をマスキング
 */
export function maskSensitiveInfo(text: string, options: MaskOptions = {}): string {
  const config = getMaskingConfig(options);
  return applyMasking(text, config);
}

/**
 * マスキング設定の取得
 */
function getMaskingConfig(options: MaskOptions): Required<MaskOptions> {
  return {
    maskApiKeys: options.maskApiKeys ?? true,
    maskWebhooks: options.maskWebhooks ?? true,
    maskPersonalInfo: options.maskPersonalInfo ?? true,
    maskDiscordIds: options.maskDiscordIds ?? false,
    preserveLength: options.preserveLength ?? false,
  };
}

/**
 * マスキングの適用
 */
function applyMasking(text: string, config: Required<MaskOptions>): string {
  let maskedText = text;

  if (config.maskApiKeys) {
    maskedText = maskPatterns(
      maskedText,
      SENSITIVE_PATTERNS.apiKeys,
      '[API_KEY_MASKED]',
      config.preserveLength
    );
  }

  if (config.maskWebhooks) {
    maskedText = maskPatterns(
      maskedText,
      SENSITIVE_PATTERNS.webhooks,
      '[WEBHOOK_MASKED]',
      config.preserveLength
    );
  }

  if (config.maskPersonalInfo) {
    maskedText = maskPersonalInfoPatterns(maskedText, config.preserveLength);
  }

  if (config.maskDiscordIds) {
    maskedText = maskDiscordIdPatterns(maskedText, config.preserveLength);
  }

  return maskedText;
}

/**
 * パターンベースのマスキング
 */
function maskPatterns(
  text: string,
  patterns: RegExp[],
  replacement: string,
  preserveLength: boolean
): string {
  let maskedText = text;
  patterns.forEach(pattern => {
    maskedText = maskedText.replace(pattern, match =>
      preserveLength ? '*'.repeat(match.length) : replacement
    );
  });
  return maskedText;
}

/**
 * 個人情報のマスキング
 */
function maskPersonalInfoPatterns(text: string, preserveLength: boolean): string {
  let maskedText = text;
  SENSITIVE_PATTERNS.personalInfo.forEach(pattern => {
    maskedText = maskedText.replace(pattern, match => {
      if (match.includes('@')) {
        return maskEmail(match);
      }
      return preserveLength ? '*'.repeat(match.length) : '[PERSONAL_INFO_MASKED]';
    });
  });
  return maskedText;
}

/**
 * メールアドレスのマスキング
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local && domain) {
    return `${local.substring(0, EMAIL_PREFIX_LENGTH)}***@${domain}`;
  }
  return '[EMAIL_MASKED]';
}

/**
 * Discord IDのマスキング
 */
function maskDiscordIdPatterns(text: string, preserveLength: boolean): string {
  let maskedText = text;
  SENSITIVE_PATTERNS.discordIds.forEach(pattern => {
    maskedText = maskedText.replace(pattern, match => {
      if (match.length >= DISCORD_ID_MIN_LENGTH) {
        return `${match.substring(0, DISCORD_ID_PREFIX_LENGTH)}***${match.substring(match.length - DISCORD_ID_SUFFIX_LENGTH)}`;
      }
      return preserveLength ? '*'.repeat(match.length) : '[ID_MASKED]';
    });
  });
  return maskedText;
}

/**
 * ログ出力時の機密情報マスキング
 */
export function maskForLogging(data: unknown): unknown {
  if (typeof data === 'string') {
    return maskSensitiveInfo(data, { preserveLength: false });
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(item => maskForLogging(item));
    }

    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // 特定のキー名は完全にマスク
      if (isSensitiveKey(key)) {
        masked[key] = '[MASKED]';
      } else {
        masked[key] = maskForLogging(value);
      }
    }
    return masked;
  }

  return data;
}

/**
 * 機密情報を含む可能性のあるキー名をチェック
 */
function isSensitiveKey(key: string): boolean {
  const sensitiveKeywords = [
    'password',
    'token',
    'key',
    'secret',
    'auth',
    'credential',
    'api_key',
    'apikey',
    'webhook',
    'discord_webhook',
    'access_token',
    'refresh_token',
    'private',
    'confidential',
    'sensitive',
  ];

  const lowerKey = key.toLowerCase();
  return sensitiveKeywords.some(keyword => lowerKey.includes(keyword));
}

/**
 * エラーメッセージの機密情報除去
 */
export function sanitizeErrorMessage(error: Error | string): string {
  const message = error instanceof Error ? error.message : error;

  // スタックトレースから機密情報を除去
  let sanitized = maskSensitiveInfo(message, {
    maskApiKeys: true,
    maskWebhooks: true,
    maskPersonalInfo: true,
    preserveLength: false,
  });

  // パスの機密部分をマスク（ユーザー名など）
  sanitized = sanitized.replace(/\/Users\/[^/]+/g, '/Users/[USER]');
  sanitized = sanitized.replace(/\\Users\\[^\\]+/g, '\\Users\\[USER]');
  sanitized = sanitized.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]');

  return sanitized;
}

/**
 * 設定値の検証とマスキング
 */
export function validateAndMaskConfig(config: Record<string, unknown>): {
  masked: Record<string, unknown>;
  securityIssues: string[];
} {
  const maskedResult = maskForLogging(config);
  const masked =
    maskedResult && typeof maskedResult === 'object' && !Array.isArray(maskedResult)
      ? (maskedResult as Record<string, unknown>)
      : {};
  const securityIssues: string[] = [];

  // APIキーの強度チェック
  Object.entries(config).forEach(([key, value]) => {
    if (isSensitiveKey(key) && typeof value === 'string') {
      if (value.length < MIN_SECURE_KEY_LENGTH) {
        securityIssues.push(`${key} appears to be too short for security`);
      }
      if (value.toLowerCase().includes('test') || value.toLowerCase().includes('demo')) {
        securityIssues.push(`${key} appears to be a test/demo key`);
      }
    }
  });

  return { masked, securityIssues };
}
