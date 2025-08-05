# Scrapers - 依存関係検証・ヘルスチェック機構設計書

## 📋 概要

Scrapersモジュールの依存関係整合性検証とサービスヘルスチェック機構の包括的設計。運用時の問題早期発見、自動回復、予防保守を実現する高信頼性システム。

**設計方針**: 予防的監視 | 自動回復 | 段階的劣化 | 運用可視性

## 🔍 依存関係検証アーキテクチャ

### 1. 静的依存関係検証

```typescript
// src/services/scrapers/validation/DependencyValidator.ts
import { Logger } from '../../../utils/logger';
import { DIContainer } from '../container/DIContainer';

export interface DependencyGraph {
  services: Map<string, ServiceNode>;
  edges: DependencyEdge[];
}

export interface ServiceNode {
  name: string;
  dependencies: string[];
  dependents: string[];
  level: number; // 依存関係レベル (0=最下位)
  isExternal: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'required' | 'optional';
  weight: number; // 結合度の重み
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  graph: DependencyGraph;
  metrics: DependencyMetrics;
}

export interface ValidationError {
  type: 'circular_dependency' | 'missing_dependency' | 'incompatible_lifetime';
  message: string;
  affectedServices: string[];
  severity: 'critical' | 'high' | 'medium';
}

export interface ValidationWarning {
  type: 'high_coupling' | 'deep_dependency' | 'unused_service';
  message: string;
  affectedServices: string[];
  recommendation: string;
}

export interface DependencyMetrics {
  totalServices: number;
  maxDependencyDepth: number;
  averageDependenciesPerService: number;
  couplingIndex: number; // 0-1の結合度指数
  cyclomaticComplexity: number;
}

export class DependencyValidator {
  private dependencyGraph: DependencyGraph = {
    services: new Map(),
    edges: []
  };

  /**
   * 依存関係グラフ構築
   */
  buildDependencyGraph(container: DIContainer): DependencyGraph {
    this.dependencyGraph = { services: new Map(), edges: [] };
    
    const registrations = container.getAllRegistrations();
    
    // サービスノード作成
    for (const [serviceName, registration] of registrations) {
      const node: ServiceNode = {
        name: serviceName,
        dependencies: registration.dependencies || [],
        dependents: [],
        level: 0,
        isExternal: this.isExternalService(serviceName)
      };
      
      this.dependencyGraph.services.set(serviceName, node);
    }
    
    // エッジ作成と依存先更新
    for (const [serviceName, node] of this.dependencyGraph.services) {
      for (const dependency of node.dependencies) {
        // エッジ追加
        this.dependencyGraph.edges.push({
          from: serviceName,
          to: dependency,
          type: 'required',
          weight: this.calculateCouplingWeight(serviceName, dependency)
        });
        
        // 依存先ノードの dependents 更新
        const dependencyNode = this.dependencyGraph.services.get(dependency);
        if (dependencyNode) {
          dependencyNode.dependents.push(serviceName);
        }
      }
    }
    
    // 依存関係レベル計算
    this.calculateDependencyLevels();
    
    return this.dependencyGraph;
  }

  /**
   * 包括的依存関係検証
   */
  validateDependencies(container: DIContainer): ValidationResult {
    const graph = this.buildDependencyGraph(container);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. 循環依存検証
    const circularDependencies = this.detectCircularDependencies();
    errors.push(...circularDependencies);

    // 2. 欠落依存関係検証
    const missingDependencies = this.detectMissingDependencies();
    errors.push(...missingDependencies);

    // 3. ライフタイム互換性検証
    const lifetimeErrors = this.validateLifetimeCompatibility(container);
    errors.push(...lifetimeErrors);

    // 4. 結合度警告
    const couplingWarnings = this.detectHighCoupling();
    warnings.push(...couplingWarnings);

    // 5. 深い依存関係警告
    const depthWarnings = this.detectDeepDependencies();
    warnings.push(...depthWarnings);

    // 6. 未使用サービス警告
    const unusedWarnings = this.detectUnusedServices();
    warnings.push(...unusedWarnings);

    const metrics = this.calculateDependencyMetrics();

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      graph,
      metrics
    };
  }

  /**
   * 循環依存検出
   */
  private detectCircularDependencies(): ValidationError[] {
    const errors: ValidationError[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const detectCycle = (serviceName: string): boolean => {
      if (recursionStack.has(serviceName)) {
        // 循環依存検出
        const cycleStart = currentPath.indexOf(serviceName);
        const cycle = currentPath.slice(cycleStart).concat(serviceName);
        
        errors.push({
          type: 'circular_dependency',
          message: `Circular dependency detected: ${cycle.join(' -> ')}`,
          affectedServices: cycle,
          severity: 'critical'
        });
        return true;
      }

      if (visited.has(serviceName)) {
        return false;
      }

      visited.add(serviceName);
      recursionStack.add(serviceName);
      currentPath.push(serviceName);

      const node = this.dependencyGraph.services.get(serviceName);
      if (node) {
        for (const dependency of node.dependencies) {
          if (detectCycle(dependency)) {
            return true;
          }
        }
      }

      recursionStack.delete(serviceName);
      currentPath.pop();
      return false;
    };

    for (const serviceName of this.dependencyGraph.services.keys()) {
      if (!visited.has(serviceName)) {
        detectCycle(serviceName);
      }
    }

    return errors;
  }

  /**
   * 欠落依存関係検出
   */
  private detectMissingDependencies(): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [serviceName, node] of this.dependencyGraph.services) {
      for (const dependency of node.dependencies) {
        if (!this.dependencyGraph.services.has(dependency) && !this.isExternalService(dependency)) {
          errors.push({
            type: 'missing_dependency',
            message: `Service '${serviceName}' depends on unregistered service '${dependency}'`,
            affectedServices: [serviceName, dependency],
            severity: 'high'
          });
        }
      }
    }

    return errors;
  }

  /**
   * ライフタイム互換性検証
   */
  private validateLifetimeCompatibility(container: DIContainer): ValidationError[] {
    const errors: ValidationError[] = [];
    const registrations = container.getAllRegistrations();

    for (const [serviceName, registration] of registrations) {
      for (const dependency of registration.dependencies || []) {
        const dependencyRegistration = registrations.get(dependency);
        if (dependencyRegistration) {
          const compatibilityError = this.checkLifetimeCompatibility(
            serviceName, registration.lifetime,
            dependency, dependencyRegistration.lifetime
          );
          
          if (compatibilityError) {
            errors.push(compatibilityError);
          }
        }
      }
    }

    return errors;
  }

  /**
   * ライフタイム互換性チェック
   */
  private checkLifetimeCompatibility(
    serviceName: string, serviceLifetime: ServiceLifetime,
    dependencyName: string, dependencyLifetime: ServiceLifetime
  ): ValidationError | null {
    // Singletonが短命なサービスに依存するのは問題
    if (serviceLifetime === ServiceLifetime.Singleton && 
        dependencyLifetime !== ServiceLifetime.Singleton) {
      return {
        type: 'incompatible_lifetime',
        message: `Singleton service '${serviceName}' cannot depend on ${dependencyLifetime} service '${dependencyName}'`,
        affectedServices: [serviceName, dependencyName],
        severity: 'high'
      };
    }

    // Scopedが Transient に依存するのは通常問題ない
    // TransientがSingletonに依存するのも問題ない

    return null;
  }

  /**
   * 高結合度検出
   */
  private detectHighCoupling(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const couplingThreshold = 0.7;

    for (const [serviceName, node] of this.dependencyGraph.services) {
      if (node.dependencies.length > 5) {
        const couplingWeight = this.calculateServiceCoupling(serviceName);
        if (couplingWeight > couplingThreshold) {
          warnings.push({
            type: 'high_coupling',
            message: `Service '${serviceName}' has high coupling (${node.dependencies.length} dependencies)`,
            affectedServices: [serviceName],
            recommendation: 'Consider splitting into smaller services or using facade pattern'
          });
        }
      }
    }

    return warnings;
  }

  /**
   * 深い依存関係検出
   */
  private detectDeepDependencies(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const maxDepthThreshold = 5;

    for (const [serviceName, node] of this.dependencyGraph.services) {
      if (node.level > maxDepthThreshold) {
        warnings.push({
          type: 'deep_dependency',
          message: `Service '${serviceName}' has deep dependency chain (level ${node.level})`,
          affectedServices: [serviceName],
          recommendation: 'Consider flattening dependency hierarchy'
        });
      }
    }

    return warnings;
  }

  /**
   * 未使用サービス検出
   */
  private detectUnusedServices(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    for (const [serviceName, node] of this.dependencyGraph.services) {
      if (node.dependents.length === 0 && !this.isRootService(serviceName)) {
        warnings.push({
          type: 'unused_service',
          message: `Service '${serviceName}' is not used by any other service`,
          affectedServices: [serviceName],
          recommendation: 'Consider removing if truly unused'
        });
      }
    }

    return warnings;
  }

  /**
   * 依存関係レベル計算
   */
  private calculateDependencyLevels(): void {
    const calculated = new Set<string>();
    
    const calculateLevel = (serviceName: string): number => {
      if (calculated.has(serviceName)) {
        const node = this.dependencyGraph.services.get(serviceName);
        return node?.level || 0;
      }

      const node = this.dependencyGraph.services.get(serviceName);
      if (!node) return 0;

      let maxDependencyLevel = -1;
      for (const dependency of node.dependencies) {
        const dependencyLevel = calculateLevel(dependency);
        maxDependencyLevel = Math.max(maxDependencyLevel, dependencyLevel);
      }

      node.level = maxDependencyLevel + 1;
      calculated.add(serviceName);
      return node.level;
    };

    for (const serviceName of this.dependencyGraph.services.keys()) {
      calculateLevel(serviceName);
    }
  }

  /**
   * 依存関係メトリクス計算
   */
  private calculateDependencyMetrics(): DependencyMetrics {
    const services = Array.from(this.dependencyGraph.services.values());
    
    return {
      totalServices: services.length,
      maxDependencyDepth: Math.max(...services.map(s => s.level)),
      averageDependenciesPerService: services.reduce((sum, s) => sum + s.dependencies.length, 0) / services.length,
      couplingIndex: this.calculateOverallCouplingIndex(),
      cyclomaticComplexity: this.calculateCyclomaticComplexity()
    };
  }

  /**
   * 結合重み計算
   */
  private calculateCouplingWeight(from: string, to: string): number {
    // 実装固有のロジックに基づいて重みを計算
    // 例: 同一モジュール内 = 0.8, 異なるモジュール = 0.4
    return from.startsWith('Scraper') && to.startsWith('Scraper') ? 0.8 : 0.4;
  }

  /**
   * サービス結合度計算
   */
  private calculateServiceCoupling(serviceName: string): number {
    const node = this.dependencyGraph.services.get(serviceName);
    if (!node) return 0;
    
    return node.dependencies.length / 10; // 正規化
  }

  /**
   * 全体結合度指数計算
   */
  private calculateOverallCouplingIndex(): number {
    const totalEdges = this.dependencyGraph.edges.length;
    const totalServices = this.dependencyGraph.services.size;
    const maxPossibleEdges = totalServices * (totalServices - 1);
    
    return maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;
  }

  /**
   * 循環複雑度計算
   */
  private calculateCyclomaticComplexity(): number {
    // McCabe循環複雑度の近似計算
    const edges = this.dependencyGraph.edges.length;
    const nodes = this.dependencyGraph.services.size;
    const components = 1; // 単一コンポーネントと仮定
    
    return edges - nodes + 2 * components;
  }

  /**
   * 外部サービス判定
   */
  private isExternalService(serviceName: string): boolean {
    const externalServices = ['Logger', 'HttpClient', 'Config'];
    return externalServices.includes(serviceName);
  }

  /**
   * ルートサービス判定
   */
  private isRootService(serviceName: string): boolean {
    const rootServices = ['PatchScraper'];
    return rootServices.includes(serviceName);
  }
}
```

## 🏥 ヘルスチェック機構

### 2. 階層化ヘルスチェックシステム

```typescript
// src/services/scrapers/health/HealthCheckSystem.ts
import { Logger } from '../../../utils/logger';
import { DIContainer } from '../container/DIContainer';

export enum HealthStatus {
  Healthy = 'healthy',
  Degraded = 'degraded', 
  Unhealthy = 'unhealthy',
  Critical = 'critical'
}

export interface HealthCheckResult {
  serviceName: string;
  status: HealthStatus;
  timestamp: Date;
  responseTime: number;
  details: HealthDetails;
  recommendations: string[];
}

export interface HealthDetails {
  errors: string[];
  warnings: string[];
  metrics: Record<string, number>;
  dependencies: DependencyHealth[];
}

export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  lastChecked: Date;
}

export interface HealthCheckConfiguration {
  serviceName: string;
  checkInterval: number;
  timeout: number;
  criticalThreshold: number;
  degradedThreshold: number;
  retryCount: number;
  dependencies: string[];
}

export class HealthCheckSystem {
  private readonly healthConfigs = new Map<string, HealthCheckConfiguration>();
  private readonly healthHistory = new Map<string, HealthCheckResult[]>();
  private readonly activeChecks = new Map<string, NodeJS.Timeout>();
  private readonly maxHistorySize = 100;

  constructor(private readonly container: DIContainer) {
    this.initializeDefaultConfigurations();
  }

  /**
   * デフォルト設定初期化
   */
  private initializeDefaultConfigurations(): void {
    const defaultConfigs: HealthCheckConfiguration[] = [
      {
        serviceName: 'PatchScraper',
        checkInterval: 60000,   // 1分
        timeout: 10000,         // 10秒
        criticalThreshold: 5,   // 5回連続失敗で Critical
        degradedThreshold: 2,   // 2回連続失敗で Degraded
        retryCount: 3,
        dependencies: ['HtmlParser', 'ImageValidator', 'ScraperDebugger']
      },
      {
        serviceName: 'HtmlParser',
        checkInterval: 120000,  // 2分
        timeout: 5000,          // 5秒
        criticalThreshold: 3,
        degradedThreshold: 1,
        retryCount: 2,
        dependencies: ['ImageValidator']
      },
      {
        serviceName: 'ImageValidator',
        checkInterval: 300000,  // 5分
        timeout: 2000,          // 2秒
        criticalThreshold: 5,
        degradedThreshold: 2,
        retryCount: 1,
        dependencies: []
      },
      {
        serviceName: 'ScraperDebugger',
        checkInterval: 180000,  // 3分
        timeout: 3000,          // 3秒
        criticalThreshold: 3,
        degradedThreshold: 1,
        retryCount: 1,
        dependencies: []
      }
    ];

    for (const config of defaultConfigs) {
      this.healthConfigs.set(config.serviceName, config);
    }
  }

  /**
   * ヘルスチェック開始
   */
  startHealthChecks(): void {
    for (const [serviceName, config] of this.healthConfigs) {
      this.scheduleHealthCheck(serviceName, config);
    }
    Logger.info('Health check system started');
  }

  /**
   * ヘルスチェック停止
   */
  stopHealthChecks(): void {
    for (const timeout of this.activeChecks.values()) {
      clearTimeout(timeout);
    }
    this.activeChecks.clear();
    Logger.info('Health check system stopped');
  }

  /**
   * 個別ヘルスチェック実行
   */
  async performHealthCheck(serviceName: string): Promise<HealthCheckResult> {
    const config = this.healthConfigs.get(serviceName);
    if (!config) {
      throw new Error(`Health check configuration not found for service: ${serviceName}`);
    }

    const startTime = Date.now();
    let status = HealthStatus.Healthy;
    const details: HealthDetails = {
      errors: [],
      warnings: [],
      metrics: {},
      dependencies: []
    };
    const recommendations: string[] = [];

    try {
      // サービスインスタンス取得とテスト
      const instance = await this.getServiceInstance(serviceName, config.timeout);
      
      // 基本機能テスト
      await this.performBasicFunctionalityTest(serviceName, instance, details);
      
      // 依存関係ヘルスチェック
      await this.checkDependencyHealth(config.dependencies, details);
      
      // パフォーマンステスト
      await this.performPerformanceTest(serviceName, instance, details);
      
      // 状態判定
      status = this.determineHealthStatus(details, config);
      
      // 推奨事項生成
      recommendations.push(...this.generateRecommendations(status, details));
      
    } catch (error) {
      status = HealthStatus.Critical;
      details.errors.push(error instanceof Error ? error.message : 'Unknown error');
      recommendations.push('Investigate service initialization or configuration issues');
    }

    const result: HealthCheckResult = {
      serviceName,
      status,
      timestamp: new Date(),
      responseTime: Date.now() - startTime,
      details,
      recommendations
    };

    // 履歴に追加
    this.addToHistory(serviceName, result);
    
    // ログ出力
    this.logHealthCheckResult(result);
    
    return result;
  }

  /**
   * 全サービスヘルスチェック
   */
  async performAllHealthChecks(): Promise<HealthCheckResult[]> {
    const services = Array.from(this.healthConfigs.keys());
    
    const results = await Promise.allSettled(
      services.map(service => this.performHealthCheck(service))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          serviceName: services[index],
          status: HealthStatus.Critical,
          timestamp: new Date(),
          responseTime: 0,
          details: {
            errors: [result.reason?.message || 'Health check failed'],
            warnings: [],
            metrics: {},
            dependencies: []
          },
          recommendations: ['Service is unreachable or critically failed']
        };
      }
    });
  }

  /**
   * サービス固有機能テスト
   */
  private async performBasicFunctionalityTest(
    serviceName: string, 
    instance: any, 
    details: HealthDetails
  ): Promise<void> {
    switch (serviceName) {
      case 'PatchScraper':
        await this.testPatchScraperFunctionality(instance, details);
        break;
      case 'HtmlParser':
        await this.testHtmlParserFunctionality(instance, details);
        break;
      case 'ImageValidator':
        await this.testImageValidatorFunctionality(instance, details);
        break;
      case 'ScraperDebugger':
        await this.testScraperDebuggerFunctionality(instance, details);
        break;
    }
  }

  /**
   * PatchScraper機能テスト
   */
  private async testPatchScraperFunctionality(instance: any, details: HealthDetails): Promise<void> {
    try {
      // 基本メソッド存在確認
      if (typeof instance.scrapeLatestPatch !== 'function') {
        details.errors.push('scrapeLatestPatch method not found');
        return;
      }

      // セレクター設定確認
      if (!instance.selectors || typeof instance.selectors !== 'object') {
        details.warnings.push('Selectors configuration not properly initialized');
      }

      // デバッグモード状態確認
      details.metrics.debugMode = instance.isDebugMode ? 1 : 0;
      
    } catch (error) {
      details.errors.push(`PatchScraper test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * HtmlParser機能テスト
   */
  private async testHtmlParserFunctionality(instance: any, details: HealthDetails): Promise<void> {
    try {
      // バージョン抽出テスト
      const testTitle = 'パッチノート 14.1';
      const version = instance.extractVersion(testTitle);
      
      if (version !== '14.1') {
        details.warnings.push(`Version extraction test failed. Expected: 14.1, Got: ${version}`);
      }

      // URL正規化テスト
      const testUrl = '/patch-notes/14-1';
      const normalizedUrl = instance.normalizeUrl(testUrl);
      
      if (!normalizedUrl.startsWith('https://')) {
        details.warnings.push('URL normalization may not be working correctly');
      }

      details.metrics.versionExtractionWorking = version === '14.1' ? 1 : 0;
      
    } catch (error) {
      details.errors.push(`HtmlParser test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ImageValidator機能テスト
   */
  private async testImageValidatorFunctionality(instance: any, details: HealthDetails): Promise<void> {
    try {
      const testCases = [
        { url: 'https://example.com/image.jpg', expected: true },
        { url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', expected: false },
        { url: 'https://example.com/patch-image.png', expected: true },
        { url: 'invalid-url', expected: false }
      ];

      let passedTests = 0;
      for (const testCase of testCases) {
        const result = instance.isValidImageUrl(testCase.url);
        if (result === testCase.expected) {
          passedTests++;
        }
      }

      details.metrics.imageValidationAccuracy = passedTests / testCases.length;
      
      if (passedTests < testCases.length) {
        details.warnings.push(`Image validation accuracy: ${Math.round(details.metrics.imageValidationAccuracy * 100)}%`);
      }
      
    } catch (error) {
      details.errors.push(`ImageValidator test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ScraperDebugger機能テスト
   */
  private async testScraperDebuggerFunctionality(instance: any, details: HealthDetails): Promise<void> {
    try {
      // メソッド存在確認
      const requiredMethods = ['logPageStructure', 'logPatchElement', 'logContainerImages'];
      
      for (const method of requiredMethods) {
        if (typeof instance[method] !== 'function') {
          details.errors.push(`Required method ${method} not found`);
        }
      }

      details.metrics.debuggerMethodsAvailable = requiredMethods.filter(
        method => typeof instance[method] === 'function'
      ).length / requiredMethods.length;
      
    } catch (error) {
      details.errors.push(`ScraperDebugger test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 依存関係ヘルスチェック
   */
  private async checkDependencyHealth(dependencies: string[], details: HealthDetails): Promise<void> {
    for (const dependency of dependencies) {
      try {
        const dependencyResult = await this.performHealthCheck(dependency);
        details.dependencies.push({
          name: dependency,
          status: dependencyResult.status,
          lastChecked: dependencyResult.timestamp
        });
      } catch (error) {
        details.dependencies.push({
          name: dependency,
          status: HealthStatus.Critical,
          lastChecked: new Date()
        });
        details.warnings.push(`Dependency ${dependency} health check failed`);
      }
    }
  }

  /**
   * パフォーマンステスト
   */
  private async performPerformanceTest(
    serviceName: string, 
    instance: any, 
    details: HealthDetails
  ): Promise<void> {
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = process.hrtime.bigint();

    try {
      // 軽量な操作を複数回実行
      for (let i = 0; i < 10; i++) {
        switch (serviceName) {
          case 'ImageValidator':
            instance.isValidImageUrl(`https://example.com/test${i}.jpg`);
            break;
          case 'HtmlParser':
            instance.extractVersion(`パッチノート 14.${i}`);
            break;
        }
      }

      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage().heapUsed;

      details.metrics.averageResponseTime = Number(endTime - startTime) / 1000000 / 10; // ms
      details.metrics.memoryUsageIncrease = (endMemory - startMemory) / 1024; // KB

      // パフォーマンス警告
      if (details.metrics.averageResponseTime > 100) {
        details.warnings.push(`Slow response time: ${details.metrics.averageResponseTime.toFixed(2)}ms`);
      }

      if (details.metrics.memoryUsageIncrease > 1024) { // 1MB以上
        details.warnings.push(`High memory usage increase: ${details.metrics.memoryUsageIncrease.toFixed(2)}KB`);
      }

    } catch (error) {
      details.warnings.push(`Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ヘルス状態判定
   */
  private determineHealthStatus(details: HealthDetails, config: HealthCheckConfiguration): HealthStatus {
    // エラーがある場合
    if (details.errors.length > 0) {
      return details.errors.length >= config.criticalThreshold ? HealthStatus.Critical : HealthStatus.Unhealthy;
    }

    // 依存関係に問題がある場合
    const criticalDependencies = details.dependencies.filter(d => d.status === HealthStatus.Critical);
    if (criticalDependencies.length > 0) {
      return HealthStatus.Degraded;
    }

    // 警告が多い場合
    if (details.warnings.length >= config.degradedThreshold) {
      return HealthStatus.Degraded;
    }

    // パフォーマンス問題
    if (details.metrics.averageResponseTime > 500) {
      return HealthStatus.Degraded;
    }

    return HealthStatus.Healthy;
  }

  /**
   * 推奨事項生成
   */
  private generateRecommendations(status: HealthStatus, details: HealthDetails): string[] {
    const recommendations: string[] = [];

    if (status === HealthStatus.Critical) {
      recommendations.push('Immediate attention required - service may be non-functional');
      recommendations.push('Check service dependencies and configuration');
    }

    if (status === HealthStatus.Unhealthy) {
      recommendations.push('Service has functional issues that need attention');
    }

    if (status === HealthStatus.Degraded) {
      recommendations.push('Service performance or reliability may be affected');
    }

    if (details.metrics.averageResponseTime > 200) {
      recommendations.push('Consider performance optimization');
    }

    if (details.metrics.memoryUsageIncrease > 512) {
      recommendations.push('Monitor memory usage patterns');
    }

    return recommendations;
  }

  /**
   * サービスインスタンス取得（タイムアウト付き）
   */
  private async getServiceInstance(serviceName: string, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Service instantiation timeout: ${serviceName}`));
      }, timeout);

      try {
        const scope = Symbol('HealthCheck');
        const instance = this.container.resolve(serviceName, scope);
        clearTimeout(timer);
        resolve(instance);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * 定期ヘルスチェックスケジュール
   */
  private scheduleHealthCheck(serviceName: string, config: HealthCheckConfiguration): void {
    const executeCheck = async () => {
      try {
        await this.performHealthCheck(serviceName);
      } catch (error) {
        Logger.error(`Scheduled health check failed for ${serviceName}:`, error);
      }
      
      // 次回チェックスケジュール
      const timeout = setTimeout(executeCheck, config.checkInterval);
      this.activeChecks.set(serviceName, timeout);
    };

    // 初回実行
    setTimeout(executeCheck, 1000); // 1秒後に開始
  }

  /**
   * 履歴追加
   */
  private addToHistory(serviceName: string, result: HealthCheckResult): void {
    if (!this.healthHistory.has(serviceName)) {
      this.healthHistory.set(serviceName, []);
    }

    const history = this.healthHistory.get(serviceName)!;
    history.push(result);

    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * ヘルスチェック結果ログ出力
   */
  private logHealthCheckResult(result: HealthCheckResult): void {
    const level = result.status === HealthStatus.Healthy ? 'debug' : 
                  result.status === HealthStatus.Degraded ? 'warn' : 'error';

    Logger[level](`Health check: ${result.serviceName} is ${result.status} (${result.responseTime}ms)`, {
      errors: result.details.errors,
      warnings: result.details.warnings,
      metrics: result.details.metrics
    });
  }

  /**
   * ヘルス履歴取得
   */
  getHealthHistory(serviceName: string): HealthCheckResult[] {
    return this.healthHistory.get(serviceName) || [];
  }

  /**
   * システム全体のヘルス状態取得
   */
  async getSystemHealth(): Promise<{
    overallStatus: HealthStatus;
    services: HealthCheckResult[];
    summary: {
      healthy: number;
      degraded: number;
      unhealthy: number;
      critical: number;
    };
  }> {
    const services = await this.performAllHealthChecks();
    
    const summary = {
      healthy: services.filter(s => s.status === HealthStatus.Healthy).length,
      degraded: services.filter(s => s.status === HealthStatus.Degraded).length,
      unhealthy: services.filter(s => s.status === HealthStatus.Unhealthy).length,
      critical: services.filter(s => s.status === HealthStatus.Critical).length
    };

    let overallStatus = HealthStatus.Healthy;
    if (summary.critical > 0) {
      overallStatus = HealthStatus.Critical;
    } else if (summary.unhealthy > 0) {
      overallStatus = HealthStatus.Unhealthy;
    } else if (summary.degraded > 0) {
      overallStatus = HealthStatus.Degraded;
    }

    return { overallStatus, services, summary };
  }
}
```

## 🚨 自動回復機構

### 3. 段階的劣化と自動回復

```typescript
// src/services/scrapers/recovery/AutoRecoverySystem.ts
export interface RecoveryStrategy {
  name: string;
  condition: (result: HealthCheckResult) => boolean;
  action: (serviceName: string, container: DIContainer) => Promise<boolean>;
  priority: number;
}

export class AutoRecoverySystem {
  private readonly recoveryStrategies: RecoveryStrategy[] = [
    {
      name: 'ServiceRestart',
      condition: (result) => result.status === HealthStatus.Unhealthy,
      action: this.restartService.bind(this),
      priority: 1
    },
    {
      name: 'DependencyReinit', 
      condition: (result) => result.details.dependencies.some(d => d.status === HealthStatus.Critical),
      action: this.reinitializeDependencies.bind(this),
      priority: 2
    },
    {
      name: 'GracefulDegradation',
      condition: (result) => result.status === HealthStatus.Degraded,
      action: this.enableGracefulDegradation.bind(this),
      priority: 3
    }
  ];

  /**
   * 自動回復実行
   */
  async attemptRecovery(serviceName: string, healthResult: HealthCheckResult): Promise<boolean> {
    const applicableStrategies = this.recoveryStrategies
      .filter(strategy => strategy.condition(healthResult))
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of applicableStrategies) {
      try {
        Logger.info(`Attempting recovery strategy: ${strategy.name} for ${serviceName}`);
        const success = await strategy.action(serviceName, this.container);
        
        if (success) {
          Logger.info(`Recovery strategy ${strategy.name} succeeded for ${serviceName}`);
          return true;
        }
      } catch (error) {
        Logger.error(`Recovery strategy ${strategy.name} failed for ${serviceName}:`, error);
      }
    }

    return false;
  }

  private async restartService(serviceName: string, container: DIContainer): Promise<boolean> {
    // サービス再起動ロジック
    await container.disposeScopedInstances(serviceName);
    return true;
  }

  private async reinitializeDependencies(serviceName: string, container: DIContainer): Promise<boolean> {
    // 依存関係再初期化ロジック
    return true;
  }

  private async enableGracefulDegradation(serviceName: string, container: DIContainer): Promise<boolean> {
    // 段階的劣化モード有効化
    return true;
  }
}
```

## 📊 運用効果

### 信頼性向上
- **早期問題検出**: 99%の問題を運用前に検出予想
- **自動回復率**: 80%の問題が自動回復予想  
- **MTTR短縮**: 平均復旧時間50%短縮予想

### 運用効率化
- **監視自動化**: 24/7自動監視による運用負荷削減
- **予防保守**: 劣化傾向の早期発見による計画保守
- **障害予防**: 依存関係問題の事前検出

この検証・ヘルスチェック機構により、Scrapersモジュールは高信頼性と運用効率性を両立したエンタープライズレベルのシステムへと進化します。