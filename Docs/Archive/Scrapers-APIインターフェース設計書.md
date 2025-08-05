# 🔌 Scrapers API インターフェース設計書

## 📋 概要

新しいScrapersアーキテクチャにおけるAPIインターフェース設計の詳細仕様書です。依存性注入、戦略パターン、設定管理を含む完全なTypeScriptインターフェース定義を提供します。

### 設計原則
- **契約ファースト**: インターフェースが実装を駆動
- **依存性注入**: テスタブルで疎結合な設計
- **戦略パターン**: 拡張可能なアルゴリズム
- **型安全性**: 完全なTypeScript型定義

## 🏗️ コアサービスインターフェース

### IPatchScrapingOrchestrator - メインオーケストレーター

```typescript
/**
 * PatchScrapingOrchestrator - ワークフロー調整の主要インターフェース
 * 
 * @description 各サービスを協調させてパッチスクレイピング全体を管理
 * @responsibility ワークフロー調整、エラーハンドリング、結果構築
 */
export interface IPatchScrapingOrchestrator {
  /**
   * 最新パッチノートをスクレイピング
   * @returns Promise<PatchNote | null> - 取得したパッチノート、またはnull
   * @throws ScrapingError - スクレイピング処理エラー時
   */
  scrapePatch(): Promise<PatchNote | null>;
  
  /**
   * 特定URLのパッチノートをスクレイピング
   * @param url - スクレイピング対象URL
   * @returns Promise<PatchNote | null> - 取得したパッチノート、またはnull
   * @throws ScrapingError - スクレイピング処理エラー時
   */
  scrapeSpecificPatch(url: string): Promise<PatchNote | null>;
  
  /**
   * スクレイピング設定の取得
   * @returns ScraperConfig - 現在の設定
   */
  getConfig(): ScraperConfig;
  
  /**
   * ヘルスチェック - 依存サービスの動作確認
   * @returns Promise<HealthCheckResult> - サービス状態
   */
  healthCheck(): Promise<HealthCheckResult>;
}
```

### IWebPageRetriever - HTTP通信インターフェース

```typescript
/**
 * IWebPageRetriever - HTTP通信専用インターフェース
 * 
 * @description Webページの取得とネットワークエラーハンドリング
 * @responsibility HTTP通信、リトライ処理、レート制限
 */
export interface IWebPageRetriever {
  /**
   * 指定URLからWebページを取得
   * @param url - 取得対象URL
   * @param options - 取得オプション（タイムアウト、リトライ等）
   * @returns Promise<string> - 取得したHTML文字列
   * @throws NetworkError - ネットワークエラー時
   */
  retrievePage(url: string, options?: RetrieveOptions): Promise<string>;
  
  /**
   * 複数URLを並列取得
   * @param urls - 取得対象URL配列
   * @param options - 取得オプション
   * @returns Promise<RetrieveResult[]> - 取得結果配列
   */
  retrievePages(urls: string[], options?: RetrieveOptions): Promise<RetrieveResult[]>;
  
  /**
   * レート制限状態の確認
   * @returns RateLimitStatus - 現在のレート制限状況
   */
  getRateLimitStatus(): RateLimitStatus;
}

/**
 * 取得オプション
 */
export interface RetrieveOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

/**
 * 取得結果
 */
export interface RetrieveResult {
  url: string;
  success: boolean;
  data?: string;
  error?: Error;
  responseTime: number;
}

/**
 * レート制限状況
 */
export interface RateLimitStatus {
  remaining: number;
  resetTime: Date;
  windowMs: number;
}
```

### IDOMNavigator - DOM操作インターフェース

```typescript
/**
 * IDOMNavigator - DOM操作専用インターフェース
 * 
 * @description セレクターによるDOM要素の検索と抽出
 * @responsibility DOM解析、要素検索、属性抽出
 */
export interface IDOMNavigator {
  /**
   * パッチ要素を検索
   * @param html - 検索対象HTML
   * @returns Element | null - 見つかったパッチ要素、またはnull
   */
  findPatchElement(html: string): Element | null;
  
  /**
   * セレクターでDOM要素を検索
   * @param html - 検索対象HTML
   * @param selectors - フォールバックセレクター配列
   * @returns Element[] - 見つかった要素配列
   */
  findElements(html: string, selectors: string[]): Element[];
  
  /**
   * 要素から属性値を抽出
   * @param element - 対象要素
   * @param attribute - 属性名
   * @returns string | null - 属性値、またはnull
   */
  extractAttribute(element: Element, attribute: string): string | null;
  
  /**
   * 要素からテキストを抽出
   * @param element - 対象要素
   * @param cleanWhitespace - 空白文字の清浄化
   * @returns string - 抽出したテキスト
   */
  extractText(element: Element, cleanWhitespace?: boolean): string;
  
  /**
   * 要素の存在確認
   * @param html - 検索対象HTML
   * @param selector - セレクター
   * @returns boolean - 要素の存在
   */
  elementExists(html: string, selector: string): boolean;
}
```

### IPatchExtractor - パッチデータ抽出インターフェース

```typescript
/**
 * IPatchExtractor - パッチデータ抽出専用インターフェース
 * 
 * @description HTMLからパッチ関連データの抽出とオブジェクト構築
 * @responsibility データ抽出、バリデーション、オブジェクト構築
 */
export interface IPatchExtractor {
  /**
   * 基本パッチデータを抽出
   * @param element - パッチ要素
   * @returns BasicPatchData - 抽出した基本データ
   * @throws ExtractionError - 抽出失敗時
   */
  extractBasicData(element: Element): BasicPatchData;
  
  /**
   * パッチタイトルを抽出
   * @param element - 対象要素
   * @returns string | null - 抽出したタイトル、またはnull
   */
  extractTitle(element: Element): string | null;
  
  /**
   * パッチURLを抽出
   * @param element - 対象要素
   * @returns string | null - 抽出したURL、またはnull
   */
  extractUrl(element: Element): string | null;
  
  /**
   * パッチノートオブジェクトを構築
   * @param basic - 基本データ
   * @param content - パッチ本文（オプション）
   * @param imageUrl - 画像URL（オプション）
   * @returns PatchNote - 構築したパッチノート
   */
  buildPatchNote(
    basic: BasicPatchData,
    content?: string,
    imageUrl?: string
  ): PatchNote;
  
  /**
   * データの妥当性を検証
   * @param data - 検証対象データ
   * @returns ValidationResult - 検証結果
   */
  validatePatchData(data: Partial<PatchNote>): ValidationResult;
}

/**
 * 基本パッチデータ
 */
export interface BasicPatchData {
  title: string;
  url: string;
  version: string;
  publishedAt: Date;
  rawImageUrl?: string;
}

/**
 * 検証結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}
```

### IContentProcessor - コンテンツ処理インターフェース

```typescript
/**
 * IContentProcessor - コンテンツ処理専用インターフェース
 * 
 * @description パッチ本文の抽出、清浄化、フォーマット
 * @responsibility コンテンツ抽出、テキスト処理、品質保証
 */
export interface IContentProcessor {
  /**
   * パッチ本文を抽出
   * @param html - 対象HTML
   * @returns string | null - 抽出した本文、またはnull
   */
  extractContent(html: string): string | null;
  
  /**
   * テキストを清浄化
   * @param content - 対象テキスト
   * @param options - 清浄化オプション
   * @returns string - 清浄化されたテキスト
   */
  cleanContent(content: string, options?: CleanOptions): string;
  
  /**
   * コンテンツの品質を評価
   * @param content - 評価対象コンテンツ
   * @returns ContentQuality - 品質評価結果
   */
  assessContentQuality(content: string): ContentQuality;
  
  /**
   * サマリーを生成
   * @param content - 対象コンテンツ
   * @param maxLength - 最大文字数
   * @returns string - 生成されたサマリー
   */
  generateSummary(content: string, maxLength?: number): string;
}

/**
 * 清浄化オプション
 */
export interface CleanOptions {
  removeExtraWhitespace?: boolean;
  normalizeLineBreaks?: boolean;
  removeHtmlTags?: boolean;
  trimContent?: boolean;
}

/**
 * コンテンツ品質
 */
export interface ContentQuality {
  score: number; // 0-100のスコア
  length: number;
  hasStructure: boolean;
  readability: number;
  issues: string[];
}
```

### IImageResolver - 画像解決インターフェース

```typescript
/**
 * IImageResolver - 画像URL解決専用インターフェース
 * 
 * @description 複数戦略による最適画像URLの決定
 * @responsibility 画像検索、品質評価、URL検証
 */
export interface IImageResolver {
  /**
   * 基本データから画像URLを解決
   * @param basicData - 基本パッチデータ
   * @returns Promise<string | null> - 解決した画像URL、またはnull
   */
  resolveFromBasicData(basicData: BasicPatchData): Promise<string | null>;
  
  /**
   * 詳細HTMLから画像URLを強化
   * @param detailHtml - 詳細ページHTML
   * @param fallbackUrl - フォールバック画像URL
   * @returns Promise<string | null> - 強化された画像URL、またはnull
   */
  enhanceImageUrl(detailHtml: string, fallbackUrl?: string): Promise<string | null>;
  
  /**
   * 利用可能な解決戦略を取得
   * @returns ImageResolutionStrategy[] - 戦略配列
   */
  getAvailableStrategies(): ImageResolutionStrategy[];
  
  /**
   * 画像品質を評価
   * @param imageUrl - 評価対象画像URL
   * @returns Promise<ImageQuality> - 品質評価結果
   */
  assessImageQuality(imageUrl: string): Promise<ImageQuality>;
  
  /**
   * 戦略を追加
   * @param strategy - 追加する戦略
   */
  addStrategy(strategy: ImageResolutionStrategy): void;
  
  /**
   * 戦略を削除
   * @param strategyName - 削除する戦略名
   */
  removeStrategy(strategyName: string): void;
}

/**
 * 画像品質評価
 */
export interface ImageQuality {
  score: number; // 0-100のスコア
  resolution: {
    width: number;
    height: number;
  };
  fileSize: number;
  format: string;
  isOptimized: boolean;
  issues: string[];
}
```

## 🎯 戦略パターンインターフェース

### IImageResolutionStrategy - 画像解決戦略

```typescript
/**
 * IImageResolutionStrategy - 画像解決戦略インターフェース
 * 
 * @description 画像URLを解決するための戦略パターン
 */
export interface IImageResolutionStrategy {
  /**
   * 戦略名を取得
   * @returns string - 戦略の一意名
   */
  getName(): string;
  
  /**
   * 戦略の説明を取得
   * @returns string - 戦略の詳細説明
   */
  getDescription(): string;
  
  /**
   * 優先度を取得（数値が小さいほど高優先度）
   * @returns number - 優先度数値
   */
  getPriority(): number;
  
  /**
   * 画像URLを解決
   * @param images - 対象画像要素配列
   * @param context - 解決コンテキスト
   * @returns Promise<string | null> - 解決した画像URL、またはnull
   */
  resolve(images: Element[], context?: ResolutionContext): Promise<string | null>;
  
  /**
   * 戦略が適用可能かを判定
   * @param context - 判定コンテキスト
   * @returns boolean - 適用可能性
   */
  canApply(context: ResolutionContext): boolean;
  
  /**
   * 戦略の設定を更新
   * @param config - 新しい設定
   */
  updateConfig(config: StrategyConfig): void;
}

/**
 * 解決コンテキスト
 */
export interface ResolutionContext {
  sourceUrl: string;
  pageType: 'list' | 'detail';
  requiredQuality: 'low' | 'medium' | 'high';
  timeoutMs: number;
  metadata?: Record<string, unknown>;
}

/**
 * 戦略設定
 */
export interface StrategyConfig {
  enabled: boolean;
  priority?: number;
  parameters?: Record<string, unknown>;
}
```

### IContentExtractionStrategy - コンテンツ抽出戦略

```typescript
/**
 * IContentExtractionStrategy - コンテンツ抽出戦略インターフェース
 */
export interface IContentExtractionStrategy {
  getName(): string;
  getDescription(): string;
  getPriority(): number;
  
  /**
   * コンテンツを抽出
   * @param html - 対象HTML
   * @param context - 抽出コンテキスト
   * @returns Promise<string | null> - 抽出したコンテンツ、またはnull
   */
  extract(html: string, context?: ExtractionContext): Promise<string | null>;
  
  canApply(context: ExtractionContext): boolean;
  updateConfig(config: StrategyConfig): void;
}

/**
 * 抽出コンテキスト
 */
export interface ExtractionContext {
  sourceUrl: string;
  contentType: 'patch-notes' | 'news' | 'announcement';
  language: string;
  expectedLength?: number;
  metadata?: Record<string, unknown>;
}
```

## ⚙️ 設定管理インターフェース

### IScraperConfig - スクレイパー設定

```typescript
/**
 * IScraperConfig - スクレイパー設定インターフェース
 */
export interface IScraperConfig {
  // 基本設定
  patchNotesUrl: string;
  debugMode: boolean;
  timeout: number;
  maxRetries: number;
  
  // 画像解決設定
  imageStrategies: string[];
  imageQualityThreshold: number;
  
  // コンテンツ処理設定
  contentMinLength: number;
  contentMaxLength: number;
  contentCleanOptions: CleanOptions;
  
  // ネットワーク設定
  rateLimitConfig: RateLimitConfig;
  httpHeaders: Record<string, string>;
  
  // セレクター設定
  selectors: SelectorSetConfig;
}

/**
 * レート制限設定
 */
export interface RateLimitConfig {
  maxRequestsPerHour: number;
  windowMs: number;
  burstLimit: number;
}

/**
 * セレクター設定セット
 */
export interface SelectorSetConfig {
  container: SelectorConfig;
  title: SelectorConfig;
  url: SelectorConfig;
  image: SelectorConfig;
  content: SelectorConfig;
}

/**
 * セレクター設定
 */
export interface SelectorConfig {
  selectors: string[];
  priority: number[];
  timeout?: number;
  required: boolean;
}
```

### ISelectorRegistry - セレクター登録管理

```typescript
/**
 * ISelectorRegistry - セレクター登録・管理インターフェース
 */
export interface ISelectorRegistry {
  /**
   * セレクターを取得
   * @param key - セレクターキー
   * @returns string[] - セレクター配列
   */
  getSelectors(key: string): string[];
  
  /**
   * セレクターを追加
   * @param key - セレクターキー
   * @param selector - 追加するセレクター
   * @param priority - 優先度（0が最高）
   */
  addSelector(key: string, selector: string, priority?: number): void;
  
  /**
   * セレクターを削除
   * @param key - セレクターキー
   * @param selector - 削除するセレクター
   */
  removeSelector(key: string, selector: string): void;
  
  /**
   * セレクターの優先度を更新
   * @param key - セレクターキー
   * @param selector - 対象セレクター
   * @param newPriority - 新しい優先度
   */
  updatePriority(key: string, selector: string, newPriority: number): void;
  
  /**
   * 成功したセレクターを記録（学習機能）
   * @param key - セレクターキー
   * @param selector - 成功したセレクター
   */
  recordSuccess(key: string, selector: string): void;
  
  /**
   * セレクター統計を取得
   * @param key - セレクターキー
   * @returns SelectorStats - 統計情報
   */
  getStats(key: string): SelectorStats;
  
  /**
   * 設定をファイルに保存
   * @param filePath - 保存先ファイルパス
   */
  saveToFile(filePath: string): Promise<void>;
  
  /**
   * 設定をファイルから読み込み
   * @param filePath - 読み込み元ファイルパス
   */
  loadFromFile(filePath: string): Promise<void>;
}

/**
 * セレクター統計
 */
export interface SelectorStats {
  totalAttempts: number;
  successCount: number;
  successRate: number;
  averageResponseTime: number;
  lastSuccessTime: Date;
  mostSuccessfulSelector: string;
}
```

### IConfigurationManager - 設定管理

```typescript
/**
 * IConfigurationManager - 設定管理インターフェース
 */
export interface IConfigurationManager {
  /**
   * 現在の設定を取得
   * @returns IScraperConfig - 現在の設定
   */
  getConfig(): IScraperConfig;
  
  /**
   * 設定を更新
   * @param updates - 更新する設定項目
   */
  updateConfig(updates: Partial<IScraperConfig>): void;
  
  /**
   * 設定をリセット
   */
  resetConfig(): void;
  
  /**
   * 設定を外部ファイルから読み込み
   * @param configPath - 設定ファイルパス
   */
  loadFromFile(configPath: string): Promise<void>;
  
  /**
   * 設定を外部ファイルに保存
   * @param configPath - 保存先ファイルパス
   */
  saveToFile(configPath: string): Promise<void>;
  
  /**
   * リモート設定を取得
   * @param configUrl - リモート設定URL
   */
  loadFromRemote(configUrl: string): Promise<void>;
  
  /**
   * 設定変更を監視
   * @param callback - 変更時のコールバック
   */
  watchChanges(callback: ConfigChangeCallback): void;
  
  /**
   * 設定の妥当性を検証
   * @param config - 検証対象設定
   * @returns ValidationResult - 検証結果
   */
  validateConfig(config: IScraperConfig): ValidationResult;
}

/**
 * 設定変更コールバック
 */
export type ConfigChangeCallback = (
  newConfig: IScraperConfig,
  oldConfig: IScraperConfig,
  changedKeys: string[]
) => void;
```

## 🚨 エラーハンドリング & 結果型

### Result型パターン

```typescript
/**
 * Result型 - エラーハンドリングの統一パターン
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

export interface Success<T> {
  success: true;
  data: T;
  metadata?: ResultMetadata;
}

export interface Failure<E> {
  success: false;
  error: E;
  metadata?: ResultMetadata;
}

export interface ResultMetadata {
  executionTime: number;
  attemptCount: number;
  strategy?: string;
  warnings?: string[];
}

/**
 * Result型ユーティリティ関数
 */
export class ResultUtils {
  static success<T>(data: T, metadata?: ResultMetadata): Success<T> {
    return { success: true, data, metadata };
  }
  
  static failure<E>(error: E, metadata?: ResultMetadata): Failure<E> {
    return { success: false, error, metadata };
  }
  
  static isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
    return result.success;
  }
  
  static isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
    return !result.success;
  }
}
```

### エラー型定義

```typescript
/**
 * スクレイピング関連エラー型
 */
export abstract class ScrapingError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly context?: ErrorContext
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  PARSING = 'PARSING',
  VALIDATION = 'VALIDATION',
  CONFIGURATION = 'CONFIGURATION',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT'
}

export interface ErrorContext {
  url?: string;
  selector?: string;
  strategy?: string;
  attemptNumber?: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 具体的なエラークラス
 */
export class NetworkError extends ScrapingError {
  readonly code = 'NETWORK_ERROR';
  readonly category = ErrorCategory.NETWORK;
}

export class ParsingError extends ScrapingError {
  readonly code = 'PARSING_ERROR';
  readonly category = ErrorCategory.PARSING;
}

export class ValidationError extends ScrapingError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = ErrorCategory.VALIDATION;
}

export class ConfigurationError extends ScrapingError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
}

export class TimeoutError extends ScrapingError {
  readonly code = 'TIMEOUT_ERROR';
  readonly category = ErrorCategory.TIMEOUT;
}

export class RateLimitError extends ScrapingError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly category = ErrorCategory.RATE_LIMIT;
}
```

## 🏭 ファクトリーインターフェース

### IScraperFactory - サービス作成ファクトリー

```typescript
/**
 * IScraperFactory - サービス作成・依存性解決インターフェース
 */
export interface IScraperFactory {
  /**
   * オーケストレーターを作成
   * @param config - スクレイパー設定
   * @returns IPatchScrapingOrchestrator - 作成されたオーケストレーター
   */
  createOrchestrator(config: IScraperConfig): IPatchScrapingOrchestrator;
  
  /**
   * Webページ取得サービスを作成
   * @param config - 設定
   * @returns IWebPageRetriever - 作成されたサービス
   */
  createWebPageRetriever(config: IScraperConfig): IWebPageRetriever;
  
  /**
   * DOM操作サービスを作成
   * @param selectorRegistry - セレクター登録
   * @returns IDOMNavigator - 作成されたサービス
   */
  createDOMNavigator(selectorRegistry: ISelectorRegistry): IDOMNavigator;
  
  /**
   * パッチ抽出サービスを作成
   * @param config - 設定
   * @returns IPatchExtractor - 作成されたサービス
   */
  createPatchExtractor(config: IScraperConfig): IPatchExtractor;
  
  /**
   * コンテンツ処理サービスを作成
   * @param config - 設定
   * @returns IContentProcessor - 作成されたサービス
   */
  createContentProcessor(config: IScraperConfig): IContentProcessor;
  
  /**
   * 画像解決サービスを作成
   * @param strategies - 解決戦略配列
   * @returns IImageResolver - 作成されたサービス
   */
  createImageResolver(strategies: IImageResolutionStrategy[]): IImageResolver;
  
  /**
   * デフォルト画像解決戦略を作成
   * @returns IImageResolutionStrategy[] - デフォルト戦略配列
   */
  createDefaultImageStrategies(): IImageResolutionStrategy[];
  
  /**
   * セレクター登録を作成
   * @param config - セレクター設定
   * @returns ISelectorRegistry - 作成された登録
   */
  createSelectorRegistry(config: SelectorSetConfig): ISelectorRegistry;
  
  /**
   * 設定管理を作成
   * @param configPath - 設定ファイルパス
   * @returns IConfigurationManager - 作成された管理
   */
  createConfigurationManager(configPath?: string): IConfigurationManager;
}
```

## 🔍 ヘルスチェック & 監視

### ヘルスチェックインターフェース

```typescript
/**
 * ヘルスチェック結果
 */
export interface HealthCheckResult {
  overall: HealthStatus;
  services: ServiceHealthStatus[];
  timestamp: Date;
  responseTime: number;
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY'
}

export interface ServiceHealthStatus {
  name: string;
  status: HealthStatus;
  message?: string;
  metrics?: ServiceMetrics;
  lastCheck: Date;
}

export interface ServiceMetrics {
  responseTime: number;
  successRate: number;
  errorCount: number;
  lastError?: Error;
}

/**
 * IHealthChecker - ヘルスチェックインターフェース
 */
export interface IHealthChecker {
  /**
   * 全体的なヘルスチェック
   * @returns Promise<HealthCheckResult> - チェック結果
   */
  checkHealth(): Promise<HealthCheckResult>;
  
  /**
   * 特定サービスのヘルスチェック
   * @param serviceName - サービス名
   * @returns Promise<ServiceHealthStatus> - サービス状態
   */
  checkServiceHealth(serviceName: string): Promise<ServiceHealthStatus>;
  
  /**
   * 継続的な監視を開始
   * @param intervalMs - チェック間隔（ミリ秒）
   * @param callback - 状態変更時のコールバック
   */
  startMonitoring(
    intervalMs: number,
    callback: HealthChangeCallback
  ): void;
  
  /**
   * 監視を停止
   */
  stopMonitoring(): void;
}

export type HealthChangeCallback = (
  current: HealthCheckResult,
  previous: HealthCheckResult
) => void;
```

## 📊 メトリクス & 監視

### パフォーマンスメトリクス

```typescript
/**
 * IMetricsCollector - メトリクス収集インターフェース
 */
export interface IMetricsCollector {
  /**
   * カウンターを増加
   * @param name - メトリクス名
   * @param value - 増加値（デフォルト: 1）
   * @param tags - タグ
   */
  incrementCounter(name: string, value?: number, tags?: Record<string, string>): void;
  
  /**
   * ゲージ値を設定
   * @param name - メトリクス名
   * @param value - 設定値
   * @param tags - タグ
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void;
  
  /**
   * ヒストグラムに値を記録
   * @param name - メトリクス名
   * @param value - 記録値
   * @param tags - タグ
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
  
  /**
   * 実行時間を測定
   * @param name - メトリクス名
   * @param operation - 測定対象の操作
   * @param tags - タグ
   */
  measureTime<T>(
    name: string,
    operation: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T>;
  
  /**
   * メトリクスをエクスポート
   * @returns Promise<MetricsSnapshot> - メトリクスのスナップショット
   */
  exportMetrics(): Promise<MetricsSnapshot>;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramData>;
  timestamp: Date;
}

export interface HistogramData {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  percentiles: Record<string, number>; // p50, p95, p99など
}
```

## 🔧 使用例

### 基本的な使用例

```typescript
// ファクトリー作成
const factory: IScraperFactory = new ScraperFactory();

// 設定管理作成
const configManager = factory.createConfigurationManager('./config/scrapers.json');
const config = configManager.getConfig();

// オーケストレーター作成
const orchestrator = factory.createOrchestrator(config);

// スクレイピング実行
try {
  const patchNote = await orchestrator.scrapePatch();
  if (patchNote) {
    console.log(`取得成功: ${patchNote.title} (${patchNote.version})`);
  } else {
    console.log('新しいパッチノートは見つかりませんでした');
  }
} catch (error) {
  if (error instanceof ScrapingError) {
    console.error(`スクレイピングエラー [${error.code}]: ${error.message}`);
  } else {
    console.error('予期しないエラー:', error);
  }
}
```

### カスタム戦略の追加

```typescript
// カスタム画像解決戦略
class CustomImageStrategy implements IImageResolutionStrategy {
  getName(): string { return 'custom-strategy'; }
  getDescription(): string { return 'Custom image resolution strategy'; }
  getPriority(): number { return 1; }
  
  async resolve(images: Element[], context?: ResolutionContext): Promise<string | null> {
    // カスタムロジック実装
    return null;
  }
  
  canApply(context: ResolutionContext): boolean {
    return context.pageType === 'detail';
  }
  
  updateConfig(config: StrategyConfig): void {
    // 設定更新ロジック
  }
}

// 戦略を登録
const imageResolver = factory.createImageResolver([]);
imageResolver.addStrategy(new CustomImageStrategy());
```

### Result型の使用

```typescript
// Result型を使用したエラーハンドリング
async function safeScraping(): Promise<Result<PatchNote, ScrapingError>> {
  try {
    const patchNote = await orchestrator.scrapePatch();
    if (patchNote) {
      return ResultUtils.success(patchNote, {
        executionTime: Date.now(),
        attemptCount: 1
      });
    } else {
      return ResultUtils.failure(
        new ValidationError('No patch note found'),
        { executionTime: Date.now(), attemptCount: 1 }
      );
    }
  } catch (error) {
    return ResultUtils.failure(
      error instanceof ScrapingError ? error : new NetworkError(error.message),
      { executionTime: Date.now(), attemptCount: 1 }
    );
  }
}

// 使用例
const result = await safeScraping();
if (ResultUtils.isSuccess(result)) {
  console.log('成功:', result.data.title);
} else {
  console.error('失敗:', result.error.message);
}
```

---

**作成者**: API Architect  
**最終更新**: 2025-01-15  
**バージョン**: 1.0.0  
**TypeScript**: 5.7.2+対応