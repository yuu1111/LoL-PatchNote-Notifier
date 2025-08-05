# Scrapers - 依存関係設定・登録パターン集

## 📋 概要

Scrapersモジュールの依存関係注入における設定パターン、登録パターン、ベストプラクティスの包括的なガイド。開発効率、保守性、拡張性を最大化する実装パターン集。

**設計思想**: 設定の外部化 | パターンの標準化 | 拡張の容易性 | 運用の安全性

## 🎯 設定パターンアーキテクチャ

### 1. 階層化設定システム

```typescript
// src/services/scrapers/config/ConfigurationSystem.ts
export interface ServiceConfiguration {
  name: string;
  lifetime: ServiceLifetime;
  dependencies: string[];
  options: ServiceOptions;
  validation: ValidationOptions;
  monitoring: MonitoringOptions;
}

export interface ServiceOptions {
  lazy?: boolean;                    // 遅延初期化
  singleton?: SingletonOptions;      // シングルトン固有設定
  scoped?: ScopedOptions;           // スコープ固有設定
  transient?: TransientOptions;     // トランジエント固有設定
  fallback?: FallbackOptions;       // フォールバック設定
}

export interface SingletonOptions {
  preload?: boolean;                // アプリ起動時に事前読み込み
  disposePriority?: number;         // 終了時の破棄優先度
}

export interface ScopedOptions {
  maxLifetime?: number;             // 最大生存時間(ms)
  memoryThreshold?: number;         // メモリ使用量閾値(KB)
  autoDispose?: boolean;            // 自動破棄有効
}

export interface TransientOptions {
  poolSize?: number;                // オブジェクトプールサイズ
  reuseThreshold?: number;          // 再利用判定閾値
}

export interface FallbackOptions {
  enabled: boolean;
  fallbackService?: string;         // フォールバックサービス名
  degradedMode?: boolean;           // 劣化モード使用
}

export interface ValidationOptions {
  required: boolean;
  healthCheck: boolean;
  dependencyCheck: boolean;
  startupValidation: boolean;
}

export interface MonitoringOptions {
  metrics: boolean;
  logging: boolean;
  performance: boolean;
  alerting: AlertingOptions;
}

export interface AlertingOptions {
  enabled: boolean;
  thresholds: {
    responseTime?: number;
    errorRate?: number;
    memoryUsage?: number;
  };
}

/**
 * 階層化設定管理システム
 */
export class ConfigurationManager {
  private readonly configurations = new Map<string, ServiceConfiguration>();
  private readonly environmentOverrides = new Map<string, Partial<ServiceConfiguration>>();
  private readonly runtimeOverrides = new Map<string, Partial<ServiceConfiguration>>();

  /**
   * 設定読み込み（環境別）
   */
  loadConfiguration(environment: 'development' | 'staging' | 'production' = 'development'): void {
    // 基本設定読み込み
    this.loadBaseConfiguration();
    
    // 環境固有設定読み込み
    this.loadEnvironmentConfiguration(environment);
    
    // ランタイム設定読み込み
    this.loadRuntimeConfiguration();
    
    // 設定検証
    this.validateConfigurations();
    
    Logger.info(`Configuration loaded for environment: ${environment}`);
  }

  /**
   * 基本設定読み込み
   */
  private loadBaseConfiguration(): void {
    const baseConfigurations: ServiceConfiguration[] = [
      {
        name: 'ImageValidator',
        lifetime: ServiceLifetime.Transient,
        dependencies: [],
        options: {
          transient: {
            poolSize: 10,
            reuseThreshold: 100
          },
          fallback: {
            enabled: false
          }
        },
        validation: {
          required: true,
          healthCheck: true,
          dependencyCheck: false,
          startupValidation: true
        },
        monitoring: {
          metrics: true,
          logging: false,
          performance: true,
          alerting: {
            enabled: false,
            thresholds: {}
          }
        }
      },
      {
        name: 'ScraperDebugger',
        lifetime: ServiceLifetime.Scoped,
        dependencies: [],
        options: {
          scoped: {
            maxLifetime: 30 * 60 * 1000, // 30分
            memoryThreshold: 10 * 1024,   // 10MB
            autoDispose: true
          },
          fallback: {
            enabled: true,
            degradedMode: true
          }
        },
        validation: {
          required: false,
          healthCheck: true,
          dependencyCheck: false,
          startupValidation: false
        },
        monitoring: {
          metrics: true,
          logging: true,
          performance: false,
          alerting: {
            enabled: false,
            thresholds: {}
          }
        }
      },
      {
        name: 'HtmlParser',
        lifetime: ServiceLifetime.Scoped,
        dependencies: ['ImageValidator'],
        options: {
          scoped: {
            maxLifetime: 15 * 60 * 1000, // 15分
            memoryThreshold: 20 * 1024,   // 20MB
            autoDispose: true
          },
          fallback: {
            enabled: true,
            degradedMode: true
          }
        },
        validation: {
          required: true,
          healthCheck: true,
          dependencyCheck: true,
          startupValidation: true
        },
        monitoring: {
          metrics: true,
          logging: true,
          performance: true,
          alerting: {
            enabled: true,
            thresholds: {
              responseTime: 1000,  // 1秒
              errorRate: 0.05,     // 5%
              memoryUsage: 50 * 1024 // 50MB
            }
          }
        }
      },
      {
        name: 'PatchScraper',
        lifetime: ServiceLifetime.Scoped,
        dependencies: ['HtmlParser', 'ImageValidator', 'ScraperDebugger'],
        options: {
          scoped: {
            maxLifetime: 60 * 60 * 1000, // 1時間
            memoryThreshold: 100 * 1024,  // 100MB
            autoDispose: false
          },
          fallback: {
            enabled: true,
            fallbackService: 'SimplePatchScraper',
            degradedMode: true
          }
        },
        validation: {
          required: true,
          healthCheck: true,
          dependencyCheck: true,
          startupValidation: true
        },
        monitoring: {
          metrics: true,
          logging: true,
          performance: true,
          alerting: {
            enabled: true,
            thresholds: {
              responseTime: 5000,   // 5秒
              errorRate: 0.01,      // 1%
              memoryUsage: 200 * 1024 // 200MB
            }
          }
        }
      }
    ];

    for (const config of baseConfigurations) {
      this.configurations.set(config.name, config);
    }
  }

  /**
   * 環境固有設定読み込み
   */
  private loadEnvironmentConfiguration(environment: string): void {
    const envOverrides: Record<string, Record<string, Partial<ServiceConfiguration>>> = {
      development: {
        'PatchScraper': {
          monitoring: {
            metrics: true,
            logging: true,
            performance: true,
            alerting: { enabled: false, thresholds: {} }
          }
        },
        'ScraperDebugger': {
          options: {
            scoped: { maxLifetime: 5 * 60 * 1000 } // 開発環境では5分
          }
        }
      },
      staging: {
        'PatchScraper': {
          monitoring: {
            alerting: {
              enabled: true,
              thresholds: {
                responseTime: 3000,
                errorRate: 0.02
              }
            }
          }
        }
      },
      production: {
        'PatchScraper': {
          options: {
            scoped: {
              maxLifetime: 24 * 60 * 60 * 1000, // 本番では24時間
              autoDispose: true
            }
          },
          monitoring: {
            alerting: {
              enabled: true,
              thresholds: {
                responseTime: 2000,
                errorRate: 0.005,
                memoryUsage: 150 * 1024
              }
            }
          }
        },
        'HtmlParser': {
          monitoring: {
            alerting: {
              enabled: true,
              thresholds: {
                responseTime: 500,
                errorRate: 0.01
              }
            }
          }
        }
      }
    };

    const overrides = envOverrides[environment] || {};
    for (const [serviceName, override] of Object.entries(overrides)) {
      this.environmentOverrides.set(serviceName, override);
    }
  }

  /**
   * ランタイム設定読み込み
   */
  private loadRuntimeConfiguration(): void {
    // 環境変数からの設定読み込み
    const runtimeConfig = {
      enableDebugMode: process.env.SCRAPER_DEBUG_MODE === 'true',
      maxMemoryUsage: parseInt(process.env.SCRAPER_MAX_MEMORY || '500') * 1024, // KB
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60') * 1000 // ms
    };

    if (runtimeConfig.enableDebugMode) {
      this.runtimeOverrides.set('ScraperDebugger', {
        validation: { required: true },
        monitoring: { logging: true }
      });
    }

    // メモリ制限の適用
    for (const config of this.configurations.values()) {
      if (config.options.scoped?.memoryThreshold && 
          config.options.scoped.memoryThreshold > runtimeConfig.maxMemoryUsage) {
        this.runtimeOverrides.set(config.name, {
          options: {
            scoped: { memoryThreshold: runtimeConfig.maxMemoryUsage }
          }
        });
      }
    }
  }

  /**
   * 最終設定取得（オーバーライド適用済み）
   */
  getServiceConfiguration(serviceName: string): ServiceConfiguration {
    const baseConfig = this.configurations.get(serviceName);
    if (!baseConfig) {
      throw new Error(`Configuration not found for service: ${serviceName}`);
    }

    // 設定のマージ
    let finalConfig = { ...baseConfig };
    
    const envOverride = this.environmentOverrides.get(serviceName);
    if (envOverride) {
      finalConfig = this.mergeConfiguration(finalConfig, envOverride);
    }

    const runtimeOverride = this.runtimeOverrides.get(serviceName);
    if (runtimeOverride) {
      finalConfig = this.mergeConfiguration(finalConfig, runtimeOverride);
    }

    return finalConfig;
  }

  /**
   * 設定マージ
   */
  private mergeConfiguration(
    base: ServiceConfiguration, 
    override: Partial<ServiceConfiguration>
  ): ServiceConfiguration {
    return {
      ...base,
      ...override,
      options: {
        ...base.options,
        ...override.options,
        singleton: { ...base.options.singleton, ...override.options?.singleton },
        scoped: { ...base.options.scoped, ...override.options?.scoped },
        transient: { ...base.options.transient, ...override.options?.transient },
        fallback: { ...base.options.fallback, ...override.options?.fallback }
      },
      validation: { ...base.validation, ...override.validation },
      monitoring: {
        ...base.monitoring,
        ...override.monitoring,
        alerting: { ...base.monitoring.alerting, ...override.monitoring?.alerting }
      }
    };
  }

  /**
   * 設定検証
   */
  private validateConfigurations(): void {
    for (const [serviceName, config] of this.configurations) {
      // 依存関係存在確認
      for (const dependency of config.dependencies) {
        if (!this.configurations.has(dependency)) {
          throw new Error(`Invalid dependency '${dependency}' for service '${serviceName}'`);
        }
      }

      // ライフタイム整合性確認
      this.validateLifetimeConsistency(serviceName, config);
    }
  }

  /**
   * ライフタイム整合性検証
   */
  private validateLifetimeConsistency(serviceName: string, config: ServiceConfiguration): void {
    if (config.lifetime === ServiceLifetime.Singleton) {
      for (const dependency of config.dependencies) {
        const depConfig = this.configurations.get(dependency);
        if (depConfig && depConfig.lifetime !== ServiceLifetime.Singleton) {
          Logger.warn(`Singleton service '${serviceName}' depends on non-singleton '${dependency}'`);
        }
      }
    }
  }

  /**
   * 全設定取得
   */
  getAllConfigurations(): Map<string, ServiceConfiguration> {
    const finalConfigurations = new Map<string, ServiceConfiguration>();
    
    for (const serviceName of this.configurations.keys()) {
      finalConfigurations.set(serviceName, this.getServiceConfiguration(serviceName));
    }
    
    return finalConfigurations;
  }
}
```

## 🏭 登録パターン集

### 2. ファクトリーパターンコレクション

```typescript
// src/services/scrapers/factories/FactoryPatterns.ts
import { DIContainer, ServiceFactory, ServiceLifetime } from '../container/DIContainer';
import { ConfigurationManager } from '../config/ConfigurationSystem';

/**
 * 基底ファクトリークラス
 */
export abstract class BaseServiceFactory<T> implements ServiceFactory<T> {
  protected constructor(
    protected readonly container: DIContainer,
    protected readonly config: ConfigurationManager
  ) {}

  abstract create(): T;

  dispose?(instance: T): Promise<void> {
    // デフォルト実装：何もしない
    return Promise.resolve();
  }

  /**
   * 設定取得ヘルパー
   */
  protected getServiceConfig(serviceName: string) {
    return this.config.getServiceConfiguration(serviceName);
  }

  /**
   * 依存関係解決ヘルパー
   */
  protected resolveDependencies<TDep>(serviceName: string, scope?: symbol): TDep[] {
    const config = this.getServiceConfig(serviceName);
    return config.dependencies.map(dep => this.container.resolve<TDep>(dep, scope));
  }
}

/**
 * ImageValidator ファクトリー（プールパターン）
 */
export class PooledImageValidatorFactory extends BaseServiceFactory<ImageValidator> {
  private readonly pool: ImageValidator[] = [];
  private readonly maxPoolSize: number;

  constructor(container: DIContainer, config: ConfigurationManager) {
    super(container, config);
    const serviceConfig = this.getServiceConfig('ImageValidator');
    this.maxPoolSize = serviceConfig.options.transient?.poolSize || 5;
  }

  create(): ImageValidator {
    // プールから取得を試行
    const pooledInstance = this.pool.pop();
    if (pooledInstance) {
      Logger.debug('ImageValidator: Reused from pool');
      return pooledInstance;
    }

    // 新規作成
    Logger.debug('ImageValidator: Created new instance');
    return new ImageValidator();
  }

  async dispose(instance: ImageValidator): Promise<void> {
    // プールに戻す
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(instance);
      Logger.debug('ImageValidator: Returned to pool');
    } else {
      Logger.debug('ImageValidator: Pool full, instance discarded');
    }
  }

  /**
   * プール統計取得
   */
  getPoolStats(): { available: number; maxSize: number; utilizationRate: number } {
    return {
      available: this.pool.length,
      maxSize: this.maxPoolSize,
      utilizationRate: (this.maxPoolSize - this.pool.length) / this.maxPoolSize
    };
  }
}

/**
 * HtmlParser ファクトリー（依存関係注入パターン）
 */
export class DependencyInjectedHtmlParserFactory extends BaseServiceFactory<HtmlParser> {
  create(): HtmlParser {
    const config = this.getServiceConfig('HtmlParser');
    
    // 依存関係解決
    const imageValidator = this.container.resolve<ImageValidator>('ImageValidator');
    
    // 設定ベースのインスタンス作成
    const parser = new HtmlParser(imageValidator);
    
    // 設定適用
    this.applyConfiguration(parser, config);
    
    Logger.debug('HtmlParser: Created with dependency injection');
    return parser;
  }

  private applyConfiguration(parser: HtmlParser, config: ServiceConfiguration): void {
    // デバッグモード設定など
    if (config.monitoring.logging) {
      // ログ有効化
    }
  }
}

/**
 * ScraperDebugger ファクトリー（遅延初期化パターン）
 */
export class LazyScraperDebuggerFactory extends BaseServiceFactory<ScraperDebugger> {
  private instance: ScraperDebugger | null = null;
  private isInitialized = false;

  create(): ScraperDebugger {
    const config = this.getServiceConfig('ScraperDebugger');
    
    if (config.options.lazy && this.instance && this.isInitialized) {
      Logger.debug('ScraperDebugger: Reused lazy instance');
      return this.instance;
    }

    this.instance = new ScraperDebugger();
    this.isInitialized = true;
    
    Logger.debug('ScraperDebugger: Created lazy instance');
    return this.instance;
  }

  async dispose(instance: ScraperDebugger): Promise<void> {
    if (this.instance === instance) {
      this.instance = null;
      this.isInitialized = false;
      Logger.debug('ScraperDebugger: Lazy instance disposed');
    }
  }
}

/**
 * PatchScraper ファクトリー（複合パターン + フォールバック）
 */
export class FallbackPatchScraperFactory extends BaseServiceFactory<PatchScraper> {
  create(): PatchScraper {
    const config = this.getServiceConfig('PatchScraper');
    
    try {
      // 通常のスクレイパー作成
      const scraper = this.createNormalScraper();
      Logger.debug('PatchScraper: Created normal instance');
      return scraper;
      
    } catch (error) {
      Logger.warn('PatchScraper: Normal creation failed, using fallback', error);
      
      if (config.options.fallback?.enabled && config.options.fallback.fallbackService) {
        return this.createFallbackScraper(config.options.fallback.fallbackService);
      }
      
      throw error;
    }
  }

  private createNormalScraper(): PatchScraper {
    const htmlParser = this.container.resolve<HtmlParser>('HtmlParser');
    const imageValidator = this.container.resolve<ImageValidator>('ImageValidator');
    const scraperDebugger = this.container.resolve<ScraperDebugger>('ScraperDebugger');
    
    return new PatchScraper(htmlParser, imageValidator, scraperDebugger);
  }

  private createFallbackScraper(fallbackServiceName: string): PatchScraper {
    // フォールバックサービスの作成
    const fallbackScraper = this.container.resolve<PatchScraper>(fallbackServiceName);
    Logger.info(`PatchScraper: Using fallback service: ${fallbackServiceName}`);
    return fallbackScraper;
  }
}

/**
 * 条件付きファクトリー（環境別インスタンス作成）
 */
export class ConditionalServiceFactory<T> extends BaseServiceFactory<T> {
  private readonly factories: Map<string, () => T> = new Map();
  
  constructor(
    container: DIContainer,
    config: ConfigurationManager,
    private readonly serviceName: string
  ) {
    super(container, config);
  }

  /**
   * 条件別ファクトリー登録
   */
  registerConditionalFactory(condition: string, factory: () => T): void {
    this.factories.set(condition, factory);
  }

  create(): T {
    const environment = process.env.NODE_ENV || 'development';
    const factory = this.factories.get(environment) || this.factories.get('default');
    
    if (!factory) {
      throw new Error(`No factory registered for condition: ${environment}`);
    }

    const instance = factory();
    Logger.debug(`${this.serviceName}: Created for condition: ${environment}`);
    return instance;
  }
}
```

### 3. 登録パターンテンプレート

```typescript
// src/services/scrapers/registration/RegistrationPatterns.ts
export class ServiceRegistrationPatterns {
  private readonly container: DIContainer;
  private readonly config: ConfigurationManager;

  constructor(container: DIContainer, config: ConfigurationManager) {
    this.container = container;
    this.config = config;
  }

  /**
   * 基本登録パターン
   */
  registerBasicServices(): void {
    // ImageValidator - プール付きTransient
    this.container.register(
      'ImageValidator',
      new PooledImageValidatorFactory(this.container, this.config),
      ServiceLifetime.Transient,
      []
    );

    // ScraperDebugger - 遅延初期化Scoped
    this.container.register(
      'ScraperDebugger',
      new LazyScraperDebuggerFactory(this.container, this.config),
      ServiceLifetime.Scoped,
      []
    );

    // HtmlParser - 依存関係注入Scoped
    this.container.register(
      'HtmlParser',
      new DependencyInjectedHtmlParserFactory(this.container, this.config),
      ServiceLifetime.Scoped,
      ['ImageValidator']
    );

    // PatchScraper - フォールバック付きScoped
    this.container.register(
      'PatchScraper',
      new FallbackPatchScraperFactory(this.container, this.config),
      ServiceLifetime.Scoped,
      ['HtmlParser', 'ImageValidator', 'ScraperDebugger']
    );
  }

  /**
   * 条件付き登録パターン
   */
  registerConditionalServices(): void {
    // 環境別HtmlParser
    const conditionalParser = new ConditionalServiceFactory<HtmlParser>(
      this.container, this.config, 'HtmlParser'
    );

    conditionalParser.registerConditionalFactory('development', () => {
      const validator = this.container.resolve<ImageValidator>('ImageValidator');
      return new HtmlParser(validator, { debugMode: true });
    });

    conditionalParser.registerConditionalFactory('production', () => {
      const validator = this.container.resolve<ImageValidator>('ImageValidator');
      return new HtmlParser(validator, { debugMode: false, optimized: true });
    });

    conditionalParser.registerConditionalFactory('default', () => {
      const validator = this.container.resolve<ImageValidator>('ImageValidator');
      return new HtmlParser(validator);
    });

    this.container.register(
      'ConditionalHtmlParser',
      conditionalParser,
      ServiceLifetime.Scoped,
      ['ImageValidator']
    );
  }

  /**
   * デコレーターパターン登録
   */
  registerDecoratedServices(): void {
    // 監視付きPatchScraper
    this.container.register(
      'MonitoredPatchScraper',
      {
        create: () => {
          const baseScraper = this.container.resolve<PatchScraper>('PatchScraper');
          return new MonitoringDecorator(baseScraper);
        }
      },
      ServiceLifetime.Scoped,
      ['PatchScraper']
    );

    // キャッシュ付きHtmlParser
    this.container.register(
      'CachedHtmlParser',
      {
        create: () => {
          const baseParser = this.container.resolve<HtmlParser>('HtmlParser');
          return new CachingDecorator(baseParser);
        }
      },
      ServiceLifetime.Scoped,
      ['HtmlParser']
    );
  }

  /**
   * ファサードパターン登録
   */
  registerFacadeServices(): void {
    this.container.register(
      'ScrapingFacade',
      {
        create: () => {
          const scraper = this.container.resolve<PatchScraper>('PatchScraper');
          const debugger = this.container.resolve<ScraperDebugger>('ScraperDebugger');
          return new ScrapingFacade(scraper, debugger);
        }
      },
      ServiceLifetime.Scoped,
      ['PatchScraper', 'ScraperDebugger']
    );
  }

  /**
   * プロキシパターン登録
   */
  registerProxyServices(): void {
    this.container.register(
      'SecurePatchScraper',
      {
        create: () => {
          const scraper = this.container.resolve<PatchScraper>('PatchScraper');
          return new SecurityProxy(scraper);
        }
      },
      ServiceLifetime.Scoped,
      ['PatchScraper']
    );
  }
}

/**
 * 監視デコレーター
 */
class MonitoringDecorator implements PatchScraper {
  constructor(private readonly wrapped: PatchScraper) {}

  async scrapeLatestPatch(): Promise<PatchNote | null> {
    const startTime = Date.now();
    try {
      const result = await this.wrapped.scrapeLatestPatch();
      const duration = Date.now() - startTime;
      Logger.info(`Scraping completed in ${duration}ms`);
      return result;
    } catch (error) {
      Logger.error('Scraping failed:', error);
      throw error;
    }
  }
}

/**
 * キャッシュデコレーター
 */
class CachingDecorator implements HtmlParser {
  private readonly cache = new Map<string, any>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5分

  constructor(private readonly wrapped: HtmlParser) {}

  extractVersion(title: string): string {
    const cacheKey = `version:${title}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }

    const result = this.wrapped.extractVersion(title);
    this.cache.set(cacheKey, { value: result, timestamp: Date.now() });
    return result;
  }

  normalizeUrl(url: string): string {
    const cacheKey = `url:${url}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }

    const result = this.wrapped.normalizeUrl(url);
    this.cache.set(cacheKey, { value: result, timestamp: Date.now() });
    return result;
  }
}
```

## 🔧 実用的な設定例

### 4. 環境別設定テンプレート

```typescript
// src/services/scrapers/config/EnvironmentTemplates.ts
export const DEVELOPMENT_CONFIG = {
  services: {
    PatchScraper: {
      monitoring: { logging: true, performance: false },
      options: { 
        scoped: { maxLifetime: 5 * 60 * 1000 },
        fallback: { enabled: false } 
      }
    },
    ScraperDebugger: {
      validation: { required: true },
      monitoring: { logging: true }
    }
  },
  global: {
    logLevel: 'debug',
    enableMetrics: true,
    enableHealthChecks: true
  }
};

export const PRODUCTION_CONFIG = {
  services: {
    PatchScraper: {
      monitoring: { 
        alerting: { 
          enabled: true,
          thresholds: { responseTime: 2000, errorRate: 0.01 }
        }
      },
      options: {
        scoped: { 
          maxLifetime: 24 * 60 * 60 * 1000,
          autoDispose: true 
        },
        fallback: { enabled: true }
      }
    },
    HtmlParser: {
      monitoring: {
        alerting: {
          enabled: true,
          thresholds: { responseTime: 500, errorRate: 0.05 }
        }
      }
    }
  },
  global: {
    logLevel: 'info',
    enableMetrics: true,
    enableHealthChecks: true,
    memoryLimit: 512 * 1024 // 512MB
  }
};
```

### 5. 動的設定更新

```typescript
// src/services/scrapers/config/DynamicConfiguration.ts
export class DynamicConfigurationManager {
  private readonly configWatchers = new Map<string, fs.FSWatcher>();
  private readonly updateCallbacks = new Map<string, ((config: any) => void)[]>();

  /**
   * 設定ファイル監視開始
   */
  startConfigWatching(configPath: string): void {
    const watcher = fs.watch(configPath, (eventType) => {
      if (eventType === 'change') {
        this.reloadConfiguration(configPath);
      }
    });

    this.configWatchers.set(configPath, watcher);
    Logger.info(`Configuration watching started: ${configPath}`);
  }

  /**
   * 設定更新コールバック登録
   */
  onConfigUpdate(serviceName: string, callback: (config: any) => void): void {
    const callbacks = this.updateCallbacks.get(serviceName) || [];
    callbacks.push(callback);
    this.updateCallbacks.set(serviceName, callbacks);
  }

  /**
   * 設定リロード
   */
  private async reloadConfiguration(configPath: string): Promise<void> {
    try {
      const newConfig = await this.loadConfigurationFile(configPath);
      
      for (const [serviceName, config] of Object.entries(newConfig.services || {})) {
        const callbacks = this.updateCallbacks.get(serviceName) || [];
        for (const callback of callbacks) {
          callback(config);
        }
      }

      Logger.info(`Configuration reloaded: ${configPath}`);
    } catch (error) {
      Logger.error(`Configuration reload failed: ${configPath}`, error);
    }
  }

  private async loadConfigurationFile(path: string): Promise<any> {
    const content = await fs.promises.readFile(path, 'utf-8');
    return JSON.parse(content);
  }
}
```

## 📊 設定パターンの効果

### 開発効率向上
- **設定の標準化**: 一貫した設定パターンにより学習コスト削減
- **環境別管理**: 環境ごとの設定差分が明確化
- **動的更新**: 再起動不要の設定変更

### 運用効率向上  
- **監視統合**: 統一された監視設定により運用負荷軽減
- **自動調整**: 環境に応じた自動最適化
- **問題予防**: 設定検証による設定ミス防止

### 拡張性確保
- **パターン再利用**: 新サービス追加時の設定作業標準化
- **フォールバック機構**: 障害時の自動復旧
- **柔軟な登録**: 複数の登録パターンによる要件対応

この設定・登録パターン集により、Scrapersモジュールは高度に設定可能で運用効率の高いエンタープライズレベルのシステムとして完成します。