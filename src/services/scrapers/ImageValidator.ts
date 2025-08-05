/**
 * Enhanced ImageValidator service
 * エンタープライズ級画像URL検証サービス - DI対応版
 */

import type { Logger } from '../../utils/logger';

/**
 * 画像URL検証結果
 */
export interface ImageValidationResult {
  isValid: boolean;
  reason?: string;
  details: {
    url: string;
    protocol: string;
    format?: string;
    size?: number;
    validationTime: number;
  };
  recommendations?: string[];
}

/**
 * 画像検証設定
 */
export interface ImageValidationConfig {
  allowedProtocols: string[];
  allowedFormats: string[];
  minDataUrlLength: number;
  maxUrlLength: number;
  strictMode: boolean;
  enableMetrics: boolean;
  customRules?: ValidationRule[];
}

/**
 * カスタム検証ルール
 */
export interface ValidationRule {
  name: string;
  validator: (url: string) => boolean;
  errorMessage: string;
  priority: number;
}

/**
 * 検証メトリクス
 */
export interface ValidationMetrics {
  totalValidations: number;
  validCount: number;
  invalidCount: number;
  averageValidationTime: number;
  protocolDistribution: Record<string, number>;
  formatDistribution: Record<string, number>;
  commonErrors: Record<string, number>;
}

/**
 * ImageValidatorインターフェース
 */
export interface ImageValidatorInterface {
  validateImageUrl(url: string): ImageValidationResult;
  validateBatch(urls: string[]): ImageValidationResult[];
  getMetrics(): ValidationMetrics;
  updateConfig(config: Partial<ImageValidationConfig>): void;
}

/**
 * エンタープライズ級画像URL検証サービス
 * 依存関係注入対応、設定可能、メトリクス収集機能付き
 */
export class ImageValidator implements ImageValidatorInterface {
  private config: ImageValidationConfig;
  private metrics: ValidationMetrics;
  private readonly startTime: number;

  constructor(
    config?: Partial<ImageValidationConfig>,
    private readonly logger?: typeof Logger
  ) {
    this.startTime = Date.now();

    // デフォルト設定
    this.config = {
      allowedProtocols: ['http:', 'https:', 'data:'],
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
      minDataUrlLength: 100,
      maxUrlLength: 2000,
      strictMode: false,
      enableMetrics: true,
      customRules: [],
      ...config,
    };

    // メトリクス初期化
    this.metrics = {
      totalValidations: 0,
      validCount: 0,
      invalidCount: 0,
      averageValidationTime: 0,
      protocolDistribution: {},
      formatDistribution: {},
      commonErrors: {},
    };

    this.logger?.debug('ImageValidator initialized with config:', this.config);
  }

  /**
   * 画像URL検証（詳細結果付き）
   */
  public validateImageUrl(url: string): ImageValidationResult {
    const startTime = performance.now();
    const result = this.performValidation(url);
    const validationTime = performance.now() - startTime;

    // メトリクス更新
    if (this.config.enableMetrics) {
      this.updateMetrics(result, validationTime);
    }

    result.details.validationTime = validationTime;

    this.logger?.debug(`Image validation: ${url} -> ${result.isValid ? 'VALID' : 'INVALID'}`, {
      reason: result.reason,
      time: validationTime,
    });

    return result;
  }

  /**
   * バッチ検証
   */
  public validateBatch(urls: string[]): ImageValidationResult[] {
    return urls.map(url => this.validateImageUrl(url));
  }

  /**
   * 後方互換性のためのシンプルな検証メソッド
   */
  public isValidImageUrl(url: string): boolean {
    return this.validateImageUrl(url).isValid;
  }

  /**
   * 検証メトリクス取得
   */
  public getMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  /**
   * 設定更新
   */
  public updateConfig(config: Partial<ImageValidationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger?.info('ImageValidator config updated:', config);
  }

  /**
   * 実際の検証処理
   */
  private performValidation(url: string): ImageValidationResult {
    // 基本的な入力検証
    const basicValidationResult = this.performBasicValidation(url);
    if (!basicValidationResult.isValid) return basicValidationResult;

    try {
      return this.performDetailedValidation(url);
    } catch (error) {
      return this.createInvalidResult(
        url,
        'validation_error',
        `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 基本的な入力検証
   */
  private performBasicValidation(url: string): ImageValidationResult {
    if (!url || typeof url !== 'string') {
      return this.createInvalidResult(
        url,
        'empty_or_invalid_input',
        'URL is empty or not a string'
      );
    }

    if (url.length > this.config.maxUrlLength) {
      return this.createInvalidResult(
        url,
        'url_too_long',
        `URL exceeds maximum length of ${this.config.maxUrlLength}`
      );
    }

    return this.createValidResult(url);
  }

  /**
   * 詳細検証処理
   */
  private performDetailedValidation(url: string): ImageValidationResult {
    // プロトコル検証
    const protocolResult = this.validateProtocol(url);
    if (!protocolResult.isValid) return protocolResult;

    // 特殊ケース検証
    const specialCaseResult = this.validateSpecialCases(url);
    if (!specialCaseResult.isValid) return specialCaseResult;

    // フォーマット検証
    const formatResult = this.validateFormat(url);
    if (!formatResult.isValid && this.config.strictMode) return formatResult;

    // カスタムルール検証
    const customRuleResult = this.validateCustomRules(url);
    if (!customRuleResult.isValid) return customRuleResult;

    // 成功
    return this.createValidResult(url, formatResult.details.format);
  }

  /**
   * プロトコル検証
   */
  private validateProtocol(url: string): ImageValidationResult {
    let protocol: string;

    try {
      if (url.startsWith('data:')) {
        protocol = 'data:';
      } else {
        const urlObj = new URL(url);
        ({ protocol } = urlObj);
      }
    } catch {
      // URL形式が無効な場合、プレフィックスで判定
      if (url.startsWith('//')) {
        protocol = 'https:'; // 相対プロトコルURLは httpsとして扱う
      } else if (url.startsWith('/')) {
        protocol = 'relative'; // 相対パス
      } else {
        return this.createInvalidResult(url, 'invalid_url_format', 'Invalid URL format');
      }
    }

    if (!this.config.allowedProtocols.includes(protocol) || protocol === 'relative') {
      return this.createInvalidResult(
        url,
        'unsupported_protocol',
        `Protocol '${protocol}' is not allowed. Allowed: ${this.config.allowedProtocols.join(', ')}`
      );
    }

    return this.createValidResult(url, undefined, protocol);
  }

  /**
   * 特殊ケース検証
   */
  private validateSpecialCases(url: string): ImageValidationResult {
    // 無効なSVG data URLを検出
    if (url.startsWith('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>')) {
      return this.createInvalidResult(url, 'empty_svg_data_url', 'Empty SVG data URL detected');
    }

    // 短すぎるdata URLを検出
    if (url.startsWith('data:') && url.length < this.config.minDataUrlLength) {
      return this.createInvalidResult(
        url,
        'data_url_too_short',
        `Data URL too short (${url.length} < ${this.config.minDataUrlLength})`
      );
    }

    // Base64形式のdata URLの基本検証
    if (url.startsWith('data:image/') && url.includes('base64,')) {
      const base64Part = url.split('base64,')[1];
      if (!base64Part || base64Part.length < 10) {
        return this.createInvalidResult(url, 'invalid_base64_data', 'Invalid or empty base64 data');
      }
    }

    return this.createValidResult(url);
  }

  /**
   * 画像フォーマット検証
   */
  private validateFormat(url: string): ImageValidationResult {
    let format: string | undefined;

    if (url.startsWith('data:image/')) {
      // data URLからのフォーマット抽出
      const match = url.match(/data:image\/([^;,]+)/);
      format = match?.[1]?.toLowerCase();
    } else {
      // 通常URLからの拡張子抽出
      const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
      format = match?.[1]?.toLowerCase();
    }

    if (format && !this.config.allowedFormats.includes(format)) {
      const recommendations = [
        `Consider using supported formats: ${this.config.allowedFormats.join(', ')}`,
        'Verify the image format is correct',
      ];

      return this.createInvalidResult(
        url,
        'unsupported_format',
        `Image format '${format}' is not supported`,
        recommendations
      );
    }

    return this.createValidResult(url, format);
  }

  /**
   * カスタムルール検証
   */
  private validateCustomRules(url: string): ImageValidationResult {
    if (!this.config.customRules || this.config.customRules.length === 0) {
      return this.createValidResult(url);
    }

    // 優先度順にソート
    const sortedRules = [...this.config.customRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      try {
        if (!rule.validator(url)) {
          return this.createInvalidResult(url, `custom_rule_${rule.name}`, rule.errorMessage);
        }
      } catch (error) {
        this.logger?.warn(`Custom rule '${rule.name}' failed:`, error);
      }
    }

    return this.createValidResult(url);
  }

  /**
   * 有効な結果オブジェクト作成
   */
  private createValidResult(
    url: string,
    format?: string,
    protocol?: string
  ): ImageValidationResult {
    return {
      isValid: true,
      details: {
        url,
        protocol: protocol ?? this.extractProtocol(url),
        ...(format && { format }),
        size: url.length,
        validationTime: 0, // 後で設定される
      },
    };
  }

  /**
   * 無効な結果オブジェクト作成
   */
  private createInvalidResult(
    url: string,
    reason: string,
    message: string,
    recommendations?: string[]
  ): ImageValidationResult {
    return {
      isValid: false,
      reason,
      details: {
        url,
        protocol: this.extractProtocol(url),
        size: url?.length,
        validationTime: 0, // 後で設定される
      },
      ...(recommendations && { recommendations }),
    };
  }

  /**
   * プロトコル抽出ヘルパー
   */
  private extractProtocol(url: string): string {
    if (!url) return 'unknown';
    if (url.startsWith('data:')) return 'data:';
    if (url.startsWith('http://')) return 'http:';
    if (url.startsWith('https://')) return 'https:';
    if (url.startsWith('//')) return 'protocol-relative';
    if (url.startsWith('/')) return 'relative';
    return 'unknown';
  }

  /**
   * メトリクス更新
   */
  private updateMetrics(result: ImageValidationResult, validationTime: number): void {
    this.metrics.totalValidations++;

    if (result.isValid) {
      this.metrics.validCount++;
    } else {
      this.metrics.invalidCount++;
      if (result.reason) {
        this.metrics.commonErrors[result.reason] =
          (this.metrics.commonErrors[result.reason] ?? 0) + 1;
      }
    }

    // 平均検証時間更新
    this.metrics.averageValidationTime =
      (this.metrics.averageValidationTime * (this.metrics.totalValidations - 1) + validationTime) /
      this.metrics.totalValidations;

    // プロトコル分布更新
    const { protocol } = result.details;
    this.metrics.protocolDistribution[protocol] =
      (this.metrics.protocolDistribution[protocol] ?? 0) + 1;

    // フォーマット分布更新
    if (result.details.format) {
      this.metrics.formatDistribution[result.details.format] =
        (this.metrics.formatDistribution[result.details.format] ?? 0) + 1;
    }
  }

  /**
   * サービス統計情報取得
   */
  public getServiceInfo(): {
    uptime: number;
    config: ImageValidationConfig;
    metrics: ValidationMetrics;
  } {
    return {
      uptime: Date.now() - this.startTime,
      config: { ...this.config },
      metrics: this.getMetrics(),
    };
  }

  /**
   * 設定リセット
   */
  public resetConfig(): void {
    this.config = {
      allowedProtocols: ['http:', 'https:', 'data:'],
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
      minDataUrlLength: 100,
      maxUrlLength: 2000,
      strictMode: false,
      enableMetrics: true,
      customRules: [],
    };
    this.logger?.info('ImageValidator config reset to defaults');
  }

  /**
   * メトリクスリセット
   */
  public resetMetrics(): void {
    this.metrics = {
      totalValidations: 0,
      validCount: 0,
      invalidCount: 0,
      averageValidationTime: 0,
      protocolDistribution: {},
      formatDistribution: {},
      commonErrors: {},
    };
    this.logger?.info('ImageValidator metrics reset');
  }
}
