/**
 * Enhanced ImageValidator Test Suite
 * エンタープライズ級画像検証サービスのテストスイート
 */

import { ImageValidator, type ValidationRule } from './ImageValidator';
import { Logger } from '../../utils/logger';

// Loggerのモック
jest.mock('../../utils/logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ImageValidator - Enhanced Enterprise Service', () => {
  let validator: ImageValidator;
  let mockLogger: jest.Mocked<typeof Logger>;

  beforeEach(() => {
    mockLogger = Logger as jest.Mocked<typeof Logger>;
    jest.clearAllMocks();
    validator = new ImageValidator(undefined, mockLogger);
  });

  describe('基本的なURL検証', () => {
    test('有効なHTTPS URLを正しく検証する', () => {
      const result = validator.validateImageUrl('https://example.com/image.jpg');

      expect(result.isValid).toBe(true);
      expect(result.details.protocol).toBe('https:');
      expect(result.details.format).toBe('jpg');
      expect(result.details.validationTime).toBeGreaterThanOrEqual(0);
    });

    test('有効なHTTP URLを正しく検証する', () => {
      const result = validator.validateImageUrl('http://example.com/image.png');

      expect(result.isValid).toBe(true);
      expect(result.details.protocol).toBe('http:');
      expect(result.details.format).toBe('png');
    });

    test('有効なdata URLを正しく検証する', () => {
      const dataUrl = `data:image/png;base64,${'a'.repeat(200)}`;
      const result = validator.validateImageUrl(dataUrl);

      expect(result.isValid).toBe(true);
      expect(result.details.protocol).toBe('data:');
      expect(result.details.format).toBe('png');
    });

    test('空のURLを拒否する', () => {
      const result = validator.validateImageUrl('');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('empty_or_invalid_input');
    });

    test('null/undefined URLを拒否する', () => {
      const result1 = validator.validateImageUrl(null as any);
      const result2 = validator.validateImageUrl(undefined as any);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });
  });

  describe('プロトコル検証', () => {
    test('許可されたプロトコルを受け入れる', () => {
      const urls = [
        'https://example.com/image.jpg',
        'http://example.com/image.jpg',
        `data:image/png;base64,${'a'.repeat(200)}`,
      ];

      urls.forEach(url => {
        const result = validator.validateImageUrl(url);
        expect(result.isValid).toBe(true);
      });
    });

    test('許可されていないプロトコルを拒否する', () => {
      const validator = new ImageValidator({ allowedProtocols: ['https:'] });
      const result = validator.validateImageUrl('http://example.com/image.jpg');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('unsupported_protocol');
    });

    test('無効なURLフォーマットを拒否する', () => {
      const result = validator.validateImageUrl('invalid-url-format');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('invalid_url_format');
    });
  });

  describe('特殊ケース検証', () => {
    test('空のSVG data URLを拒否する', () => {
      const emptyDataUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
      const result = validator.validateImageUrl(emptyDataUrl);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('empty_svg_data_url');
    });

    test('短すぎるdata URLを拒否する', () => {
      const shortDataUrl = 'data:image/png;base64,abc';
      const result = validator.validateImageUrl(shortDataUrl);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('data_url_too_short');
    });

    test('無効なBase64データを拒否する', () => {
      const invalidBase64Url = 'data:image/png;base64,';
      const result = validator.validateImageUrl(invalidBase64Url);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('data_url_too_short');
    });

    test('長すぎるURLを拒否する', () => {
      const validator = new ImageValidator({ maxUrlLength: 100 });
      const longUrl = `https://example.com/${'a'.repeat(200)}.jpg`;
      const result = validator.validateImageUrl(longUrl);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('url_too_long');
    });
  });

  describe('フォーマット検証', () => {
    test('サポートされている画像フォーマットを受け入れる', () => {
      const formats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];

      formats.forEach(format => {
        const url = `https://example.com/image.${format}`;
        const result = validator.validateImageUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.details.format).toBe(format);
      });
    });

    test('strictModeでサポートされていないフォーマットを拒否する', () => {
      const validator = new ImageValidator({
        strictMode: true,
        allowedFormats: ['jpg', 'png'],
      });
      const result = validator.validateImageUrl('https://example.com/image.tiff');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('unsupported_format');
      expect(result.recommendations).toContain('Consider using supported formats: jpg, png');
    });

    test('非strictModeでサポートされていないフォーマットを警告付きで受け入れる', () => {
      const validator = new ImageValidator({
        strictMode: false,
        allowedFormats: ['jpg', 'png'],
      });
      const result = validator.validateImageUrl('https://example.com/image.tiff');

      expect(result.isValid).toBe(true); // 非strictモードでは受け入れる
    });
  });

  describe('カスタムルール検証', () => {
    test('カスタムルールが正しく適用される', () => {
      const customRule: ValidationRule = {
        name: 'patch_images_only',
        validator: (url: string) => url.includes('patch'),
        errorMessage: 'Only patch-related images are allowed',
        priority: 1,
      };

      const validator = new ImageValidator({ customRules: [customRule] });

      const validResult = validator.validateImageUrl('https://example.com/patch-14.1.jpg');
      expect(validResult.isValid).toBe(true);

      const invalidResult = validator.validateImageUrl('https://example.com/random.jpg');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.reason).toBe('custom_rule_patch_images_only');
    });

    test('複数のカスタムルールが優先度順に適用される', () => {
      const rules: ValidationRule[] = [
        {
          name: 'low_priority',
          validator: () => false,
          errorMessage: 'Low priority rule',
          priority: 1,
        },
        {
          name: 'high_priority',
          validator: () => false,
          errorMessage: 'High priority rule',
          priority: 10,
        },
      ];

      const validator = new ImageValidator({ customRules: rules });
      const result = validator.validateImageUrl('https://example.com/image.jpg');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('custom_rule_high_priority');
    });

    test('カスタムルールでエラーが発生しても処理を継続する', () => {
      const faultyRule: ValidationRule = {
        name: 'faulty_rule',
        validator: () => {
          throw new Error('Rule error');
        },
        errorMessage: 'This should not be reached',
        priority: 1,
      };

      const validator = new ImageValidator({ customRules: [faultyRule] }, mockLogger);
      const result = validator.validateImageUrl('https://example.com/image.jpg');

      expect(result.isValid).toBe(true); // エラーが発生しても有効として処理
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Custom rule 'faulty_rule' failed:",
        expect.any(Error)
      );
    });
  });

  describe('バッチ検証', () => {
    test('複数のURLを一度に検証できる', () => {
      const urls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.png',
        'invalid-url',
      ];

      const results = validator.validateBatch(urls);

      expect(results).toHaveLength(3);
      expect(results[0]?.isValid).toBe(true);
      expect(results[1]?.isValid).toBe(true);
      expect(results[2]?.isValid).toBe(false);
    });
  });

  describe('メトリクス機能', () => {
    test('検証メトリクスが正しく収集される', () => {
      validator.validateImageUrl('https://example.com/image.jpg'); // 有効
      validator.validateImageUrl('invalid-url'); // 無効
      validator.validateImageUrl('https://example.com/image.png'); // 有効

      const metrics = validator.getMetrics();

      expect(metrics.totalValidations).toBe(3);
      expect(metrics.validCount).toBe(2);
      expect(metrics.invalidCount).toBe(1);
      expect(metrics.averageValidationTime).toBeGreaterThan(0);
      expect(metrics.protocolDistribution['https:']).toBe(2);
      expect(metrics.formatDistribution['jpg']).toBe(1);
      expect(metrics.formatDistribution['png']).toBe(1);
    });

    test('メトリクスを無効にできる', () => {
      const validator = new ImageValidator({ enableMetrics: false });
      validator.validateImageUrl('https://example.com/image.jpg');

      const metrics = validator.getMetrics();
      expect(metrics.totalValidations).toBe(0);
    });

    test('メトリクスをリセットできる', () => {
      validator.validateImageUrl('https://example.com/image.jpg');
      expect(validator.getMetrics().totalValidations).toBe(1);

      validator.resetMetrics();
      expect(validator.getMetrics().totalValidations).toBe(0);
    });
  });

  describe('設定管理', () => {
    test('設定を動的に更新できる', () => {
      validator.updateConfig({ strictMode: true, maxUrlLength: 50 });

      const longUrl = `https://example.com/${'a'.repeat(100)}.jpg`;
      const result = validator.validateImageUrl(longUrl);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('url_too_long');
    });

    test('設定をデフォルトにリセットできる', () => {
      validator.updateConfig({ maxUrlLength: 50 });
      validator.resetConfig();

      const longUrl = `https://example.com/${'a'.repeat(100)}.jpg`;
      const result = validator.validateImageUrl(longUrl);

      expect(result.isValid).toBe(true); // デフォルト設定では受け入れられる
    });
  });

  describe('後方互換性', () => {
    test('従来のisValidImageUrlメソッドが動作する', () => {
      expect(validator.isValidImageUrl('https://example.com/image.jpg')).toBe(true);
      expect(validator.isValidImageUrl('invalid-url')).toBe(false);
    });
  });

  describe('サービス情報', () => {
    test('サービス統計情報を取得できる', () => {
      const info = validator.getServiceInfo();

      expect(info.uptime).toBeGreaterThanOrEqual(0);
      expect(info.config).toBeDefined();
      expect(info.metrics).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    test('予期しないエラーを適切に処理する', () => {
      // URLコンストラクタがエラーを投げる場合をテスト
      const result = validator.validateImageUrl('ht!tp://invalid');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('invalid_url_format');
    });
  });

  describe('パフォーマンス', () => {
    test('大量のURL検証でもパフォーマンスが維持される', () => {
      const urls = Array.from({ length: 1000 }, (_, i) => `https://example.com/image${i}.jpg`);

      const startTime = performance.now();
      const results = validator.validateBatch(urls);
      const endTime = performance.now();

      expect(results).toHaveLength(1000);
      expect(results.every(r => r.isValid)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    });

    test('検証時間が記録される', () => {
      const result = validator.validateImageUrl('https://example.com/image.jpg');

      expect(result.details.validationTime).toBeGreaterThanOrEqual(0);
      expect(result.details.validationTime).toBeLessThan(100); // 100ms以内
    });
  });

  describe('ログ機能', () => {
    test('検証結果がログに記録される', () => {
      validator.validateImageUrl('https://example.com/image.jpg');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Image validation: https://example.com/image.jpg -> VALID',
        expect.objectContaining({ time: expect.any(Number) })
      );
    });

    test('設定更新がログに記録される', () => {
      validator.updateConfig({ strictMode: true });

      expect(mockLogger.info).toHaveBeenCalledWith('ImageValidator config updated:', {
        strictMode: true,
      });
    });
  });

  // 従来のテストも保持（互換性確認）
  describe('従来のテストケース（互換性確認）', () => {
    it('HTTP URLを有効として判定する', () => {
      const url = 'http://example.com/image.jpg';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(true);
    });

    it('HTTPS URLを有効として判定する', () => {
      const url = 'https://example.com/image.png';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(true);
    });

    it('有効なdata URLを有効として判定する', () => {
      const url =
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//gA+Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2NjIpLCBkZWZhdWx0IHF1YWxpdHkK/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(true);
    });

    it('無効なSVG data URLを無効として判定する', () => {
      const url = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(false);
    });

    it('短いdata URLを無効として判定する', () => {
      const url =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(false);
    });

    it('data URLでない短いURLを無効として判定する', () => {
      const url = 'short';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(false);
    });

    it('空の文字列を無効として判定する', () => {
      const url = '';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(false);
    });

    it('data:以外のプロトコルを無効として判定する', () => {
      const url = 'ftp://example.com/image.jpg';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(false);
    });

    it('相対URLを無効として判定する', () => {
      const url = '/images/photo.jpg';
      const result = validator.isValidImageUrl(url);
      expect(result).toBe(false);
    });
  });
});
