# Scrapers - サービスライフサイクル管理戦略

## 📋 概要

Scrapersモジュールにおけるサービスインスタンスのライフサイクル管理戦略。メモリ効率、パフォーマンス、リソース管理を最適化する包括的なライフサイクル設計。

**管理原則**: リソース効率性 | 状態管理 | 並行安全性 | エラー回復力

## 🔄 サービスライフタイム分類

### 1. Singleton Services (アプリケーション全体で共有)

```typescript
// src/services/scrapers/lifecycle/SingletonServices.ts
export const SINGLETON_SERVICES = {
  // 設定管理 - アプリケーション全体で同一の設定を使用
  ConfigManager: {
    lifetime: ServiceLifetime.Singleton,
    reason: '設定は不変で全サービスで共有',
    memoryImpact: 'Low (~1KB)',
    initializationCost: 'Low'
  },
  
  // ログサービス - 出力先が統一されている必要がある
  Logger: {
    lifetime: ServiceLifetime.Singleton,
    reason: 'ログ出力の一元管理とファイルハンドル効率化',
    memoryImpact: 'Medium (~5KB)',
    initializationCost: 'Medium'
  },
  
  // HTTPクライアント - 接続プール・Keep-Alive最適化
  HttpClient: {
    lifetime: ServiceLifetime.Singleton,
    reason: 'TCPコネクション再利用とリクエスト制限管理', 
    memoryImpact: 'Medium (~10KB)',
    initializationCost: 'High'
  },
  
  // メトリクス収集 - 全体統計の一元管理
  MetricsCollector: {
    lifetime: ServiceLifetime.Singleton,
    reason: 'アプリケーション全体のメトリクス統合',
    memoryImpact: 'Medium (~8KB)',
    initializationCost: 'Low'
  }
} as const;
```

### 2. Scoped Services (処理単位で共有)

```typescript
// src/services/scrapers/lifecycle/ScopedServices.ts
export const SCOPED_SERVICES = {
  // メインスクレイピング処理 - 処理単位で状態管理
  PatchScraper: {
    lifetime: ServiceLifetime.Scoped,
    reason: 'スクレイピング処理単位でのキャッシュと状態管理',
    memoryImpact: 'High (~50KB)',
    scopeBoundary: 'スクレイピング実行単位'
  },
  
  // HTML解析 - DOM解析結果のキャッシュ
  HtmlParser: {
    lifetime: ServiceLifetime.Scoped,
    reason: 'DOM解析結果の処理内キャッシュ',
    memoryImpact: 'Medium (~20KB)',
    scopeBoundary: 'HTML解析処理単位'
  },
  
  // デバッガー - デバッグ状態の管理
  ScraperDebugger: {
    lifetime: ServiceLifetime.Scoped,
    reason: 'デバッグセッション状態とログ関連付け',
    memoryImpact: 'Low (~5KB)',
    scopeBoundary: 'デバッグセッション単位'
  },
  
  // セレクター管理 - 動的セレクター更新の管理
  SelectorManager: {
    lifetime: ServiceLifetime.Scoped,
    reason: 'セレクター試行状態と学習結果管理',
    memoryImpact: 'Medium (~15KB)',
    scopeBoundary: 'セレクター解決単位'
  }
} as const;
```

### 3. Transient Services (毎回新規作成)

```typescript
// src/services/scrapers/lifecycle/TransientServices.ts
export const TRANSIENT_SERVICES = {
  // 画像バリデーター - 純粋関数的サービス
  ImageValidator: {
    lifetime: ServiceLifetime.Transient,
    reason: '状態を持たない純粋なバリデーション処理',
    memoryImpact: 'Minimal (~1KB)',
    creationCost: 'Minimal'
  },
  
  // URL正規化 - 純粋関数的変換
  UrlNormalizer: {
    lifetime: ServiceLifetime.Transient,
    reason: '状態を持たないURL変換処理',
    memoryImpact: 'Minimal (~500B)',
    creationCost: 'Minimal'
  },
  
  // データ変換 - 純粋なデータ変換処理
  DataTransformer: {
    lifetime: ServiceLifetime.Transient,
    reason: '状態を持たないデータ変換処理',
    memoryImpact: 'Minimal (~2KB)',
    creationCost: 'Minimal'
  }
} as const;
```

## 🏗️ ライフサイクル管理アーキテクチャ

### 1. スコープマネージャー

```typescript
// src/services/scrapers/lifecycle/ScopeManager.ts
import { Logger } from '../../../utils/logger';
import { DIContainer } from '../container/DIContainer';

export interface ScopeInfo {
  id: symbol;
  name: string;
  createdAt: Date;
  lastAccessedAt: Date;
  memoryUsage: number;
  activeServices: Set<string>;
}

export class AdvancedScopeManager {
  private readonly scopes = new Map<symbol, ScopeInfo>();
  private readonly scopeTimeouts = new Map<symbol, NodeJS.Timeout>();
  private readonly maxScopeLifetime = 30 * 60 * 1000; // 30分
  private readonly scopeCleanupInterval = 5 * 60 * 1000; // 5分

  constructor(private readonly container: DIContainer) {
    this.startPeriodicCleanup();
  }

  /**
   * 新しいスコープ作成
   */
  createScope(name: string = 'DefaultScope'): symbol {
    const scopeId = Symbol(`Scope_${name}_${Date.now()}`);
    const scopeInfo: ScopeInfo = {
      id: scopeId,
      name,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      memoryUsage: 0,
      activeServices: new Set()
    };

    this.scopes.set(scopeId, scopeInfo);
    this.scheduleAutoCleanup(scopeId);
    
    Logger.debug(`Scope created: ${name} (${scopeId.toString()})`);
    return scopeId;
  }

  /**
   * スコープアクセス記録
   */
  recordScopeAccess(scopeId: symbol, serviceName: string): void {
    const scopeInfo = this.scopes.get(scopeId);
    if (scopeInfo) {
      scopeInfo.lastAccessedAt = new Date();
      scopeInfo.activeServices.add(serviceName);
      
      // タイムアウトをリセット
      this.rescheduleAutoCleanup(scopeId);
    }
  }

  /**
   * スコープメモリ使用量更新
   */
  updateScopeMemoryUsage(scopeId: symbol, memoryDelta: number): void {
    const scopeInfo = this.scopes.get(scopeId);
    if (scopeInfo) {
      scopeInfo.memoryUsage += memoryDelta;
    }
  }

  /**
   * アクティブスコープ情報取得
   */
  getActiveScopeInfo(): ScopeInfo[] {
    return Array.from(this.scopes.values());
  }

  /**
   * 手動スコープ終了
   */
  async endScope(scopeId: symbol): Promise<void> {
    const scopeInfo = this.scopes.get(scopeId);
    if (!scopeInfo) {
      Logger.warn(`Scope not found: ${scopeId.toString()}`);
      return;
    }

    try {
      // DIコンテナのスコープ破棄
      await this.container.disposeScope(scopeId);
      
      // タイムアウトクリア
      const timeout = this.scopeTimeouts.get(scopeId);
      if (timeout) {
        clearTimeout(timeout);
        this.scopeTimeouts.delete(scopeId);
      }
      
      // スコープ情報削除
      this.scopes.delete(scopeId);
      
      Logger.info(`Scope ended: ${scopeInfo.name}, Services: ${scopeInfo.activeServices.size}, Memory: ${scopeInfo.memoryUsage}KB`);
    } catch (error) {
      Logger.error(`Error ending scope ${scopeInfo.name}:`, error);
    }
  }

  /**
   * 自動クリーンアップスケジュール
   */
  private scheduleAutoCleanup(scopeId: symbol): void {
    const timeout = setTimeout(async () => {
      Logger.debug(`Auto-cleanup triggered for scope: ${scopeId.toString()}`);
      await this.endScope(scopeId);
    }, this.maxScopeLifetime);

    this.scopeTimeouts.set(scopeId, timeout);
  }

  /**
   * 自動クリーンアップ再スケジュール
   */
  private rescheduleAutoCleanup(scopeId: symbol): void {
    const existingTimeout = this.scopeTimeouts.get(scopeId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    this.scheduleAutoCleanup(scopeId);
  }

  /**
   * 定期クリーンアップ開始
   */
  private startPeriodicCleanup(): void {
    setInterval(async () => {
      await this.cleanupInactiveScopes();
    }, this.scopeCleanupInterval);
  }

  /**
   * 非アクティブスコープのクリーンアップ
   */
  private async cleanupInactiveScopes(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = 15 * 60 * 1000; // 15分間非アクティブ
    
    const inactiveScopes = Array.from(this.scopes.entries()).filter(
      ([_, scopeInfo]) => now.getTime() - scopeInfo.lastAccessedAt.getTime() > inactiveThreshold
    );

    for (const [scopeId, scopeInfo] of inactiveScopes) {
      Logger.debug(`Cleaning up inactive scope: ${scopeInfo.name}`);
      await this.endScope(scopeId);
    }
  }

  /**
   * 全スコープ強制終了
   */
  async dispose(): Promise<void> {
    const allScopes = Array.from(this.scopes.keys());
    
    await Promise.allSettled(
      allScopes.map(scopeId => this.endScope(scopeId))
    );

    // 全タイムアウトクリア
    for (const timeout of this.scopeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.scopeTimeouts.clear();
    
    Logger.info('ScopeManager disposed');
  }
}
```

### 2. リソース監視・最適化

```typescript
// src/services/scrapers/lifecycle/ResourceMonitor.ts
export interface ResourceMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  scopeMetrics: {
    activeScopeCount: number;
    averageMemoryPerScope: number;
    oldestScopeAge: number;
  };
  serviceMetrics: {
    singletonCount: number;
    scopedInstanceCount: number;
    transientCreationRate: number;
  };
}

export class ResourceMonitor {
  private metricsHistory: ResourceMetrics[] = [];
  private readonly maxHistorySize = 100;
  private monitoringInterval: NodeJS.Timer | null = null;

  constructor(
    private readonly container: DIContainer,
    private readonly scopeManager: AdvancedScopeManager
  ) {}

  /**
   * リソース監視開始
   */
  startMonitoring(intervalMs: number = 60000): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
    
    Logger.debug(`Resource monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * リソース監視停止
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      Logger.debug('Resource monitoring stopped');
    }
  }

  /**
   * 現在のリソースメトリクス収集
   */
  collectMetrics(): ResourceMetrics {
    const memoryUsage = process.memoryUsage();
    const scopeInfos = this.scopeManager.getActiveScopeInfo();
    const now = Date.now();

    const metrics: ResourceMetrics = {
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      scopeMetrics: {
        activeScopeCount: scopeInfos.length,
        averageMemoryPerScope: scopeInfos.length > 0 
          ? Math.round(scopeInfos.reduce((sum, scope) => sum + scope.memoryUsage, 0) / scopeInfos.length)
          : 0,
        oldestScopeAge: scopeInfos.length > 0
          ? Math.max(...scopeInfos.map(scope => now - scope.createdAt.getTime()))
          : 0
      },
      serviceMetrics: {
        singletonCount: this.container.getSingletonCount(),
        scopedInstanceCount: this.container.getScopedInstanceCount(),
        transientCreationRate: this.container.getTransientCreationRate()
      }
    };

    // 履歴に追加
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // アラート条件チェック
    this.checkResourceAlerts(metrics);

    return metrics;
  }

  /**
   * リソースアラート検証
   */
  private checkResourceAlerts(metrics: ResourceMetrics): void {
    // メモリ使用量アラート
    if (metrics.memoryUsage.heapUsed > 500) { // 500MB
      Logger.warn(`High memory usage detected: ${metrics.memoryUsage.heapUsed}MB`);
    }

    // スコープ数アラート
    if (metrics.scopeMetrics.activeScopeCount > 10) {
      Logger.warn(`High active scope count: ${metrics.scopeMetrics.activeScopeCount}`);
    }

    // 古いスコープアラート
    const sixHours = 6 * 60 * 60 * 1000;
    if (metrics.scopeMetrics.oldestScopeAge > sixHours) {
      Logger.warn(`Old scope detected: ${Math.round(metrics.scopeMetrics.oldestScopeAge / 60000)}min old`);
    }
  }

  /**
   * メトリクス履歴取得
   */
  getMetricsHistory(): ResourceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * リソース使用傾向分析
   */
  analyzeResourceTrends(): {
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    scopeTrend: 'increasing' | 'decreasing' | 'stable';
    recommendation: string;
  } {
    if (this.metricsHistory.length < 5) {
      return {
        memoryTrend: 'stable',
        scopeTrend: 'stable',
        recommendation: 'Insufficient data for trend analysis'
      };
    }

    const recent = this.metricsHistory.slice(-5);
    const memoryValues = recent.map(m => m.memoryUsage.heapUsed);
    const scopeValues = recent.map(m => m.scopeMetrics.activeScopeCount);

    const memoryTrend = this.calculateTrend(memoryValues);
    const scopeTrend = this.calculateTrend(scopeValues);

    let recommendation = 'Resource usage is within normal parameters';
    
    if (memoryTrend === 'increasing' && recent[recent.length - 1].memoryUsage.heapUsed > 300) {
      recommendation = 'Consider enabling more aggressive scope cleanup';
    } else if (scopeTrend === 'increasing' && recent[recent.length - 1].scopeMetrics.activeScopeCount > 5) {
      recommendation = 'Review scope lifecycle - potential scope leaks detected';
    }

    return { memoryTrend, scopeTrend, recommendation };
  }

  /**
   * 数値配列のトレンド計算
   */
  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const threshold = Math.max(first * 0.1, 1); // 10%または最小1の変化
    
    if (last > first + threshold) return 'increasing';
    if (last < first - threshold) return 'decreasing';
    return 'stable';
  }
}
```

### 3. ライフサイクルフック & イベント

```typescript
// src/services/scrapers/lifecycle/LifecycleHooks.ts
export interface LifecycleEvent {
  type: 'service_created' | 'service_disposed' | 'scope_created' | 'scope_ended';
  serviceName?: string;
  scopeId?: symbol;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface LifecycleHook {
  name: string;
  event: LifecycleEvent['type'];
  handler: (event: LifecycleEvent) => Promise<void> | void;
}

export class LifecycleEventManager {
  private readonly hooks = new Map<string, LifecycleHook[]>();
  private readonly eventHistory: LifecycleEvent[] = [];
  private readonly maxHistorySize = 1000;

  /**
   * ライフサイクルフック登録
   */
  registerHook(hook: LifecycleHook): void {
    const eventHooks = this.hooks.get(hook.event) || [];
    eventHooks.push(hook);
    this.hooks.set(hook.event, eventHooks);
    
    Logger.debug(`Lifecycle hook registered: ${hook.name} for ${hook.event}`);
  }

  /**
   * ライフサイクルイベント発火
   */
  async emitEvent(event: LifecycleEvent): Promise<void> {
    // イベント履歴に追加
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // 該当するフックを実行
    const eventHooks = this.hooks.get(event.type) || [];
    
    await Promise.allSettled(
      eventHooks.map(async hook => {
        try {
          await hook.handler(event);
        } catch (error) {
          Logger.error(`Lifecycle hook error (${hook.name}):`, error);
        }
      })
    );
  }

  /**
   * イベント履歴取得
   */
  getEventHistory(eventType?: LifecycleEvent['type']): LifecycleEvent[] {
    if (eventType) {
      return this.eventHistory.filter(event => event.type === eventType);
    }
    return [...this.eventHistory];
  }
}

// 標準的なライフサイクルフック定義
export const STANDARD_LIFECYCLE_HOOKS: LifecycleHook[] = [
  {
    name: 'MemoryTracker',
    event: 'service_created',
    handler: (event) => {
      Logger.debug(`Service created: ${event.serviceName} at ${event.timestamp.toISOString()}`);
    }
  },
  {
    name: 'ScopeLogger',
    event: 'scope_created', 
    handler: (event) => {
      Logger.info(`Scope created: ${event.scopeId?.toString()} at ${event.timestamp.toISOString()}`);
    }
  },
  {
    name: 'ScopeEndLogger',
    event: 'scope_ended',
    handler: (event) => {
      Logger.info(`Scope ended: ${event.scopeId?.toString()}, Duration: ${event.metadata?.duration}ms`);
    }
  }
];
```

## 🎯 最適化戦略

### メモリ最適化
- **Singleton**: 重い初期化コストのサービス
- **Scoped**: 処理単位での状態共有が必要なサービス
- **Transient**: 軽量で状態を持たないサービス

### パフォーマンス最適化
- **遅延初期化**: 必要時までインスタンス作成を遅延
- **プール再利用**: 高頻度作成サービスのオブジェクトプール
- **キャッシュ戦略**: 計算結果の適切なキャッシュ

### 並行性対応
- **スレッドセーフ**: Singletonサービスの並行アクセス対応
- **スコープ分離**: 並列処理時のスコープ独立性保証

## 📊 実装効果

### リソース効率化
- **メモリ使用量**: 適切なライフタイム選択により30%削減予想
- **初期化コスト**: Singleton化により50%削減予想
- **GCプレッシャー**: Transient最適化により40%削減予想

### 管理性向上
- **リソースリーク防止**: 自動スコープクリーンアップ
- **監視可視性**: 詳細なメトリクス収集
- **障害復旧**: ライフサイクルイベントベースの回復機構

このライフサイクル管理戦略により、Scrapersモジュールは効率的で監視可能な、エンタープライズレベルのリソース管理を実現します。