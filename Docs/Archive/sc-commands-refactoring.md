# PatchScraper.ts リファクタリング実行コマンド集

## 概要

PatchScraper.tsのリファクタリング作業を段階的に実行するための/scコマンド集です。18-22時間の作業を効率的に進めるためのステップバイステップガイドです。

## 前提条件

- TypeScript/Node.js基礎知識
- Jest テストフレームワーク理解
- Single Responsibility Principle理解

## Phase 1: 分析・設計 (4-6時間)

### 1.1 既存コード分析

```bash
# 既存コードの複雑性分析
/sc:analyze src/services/PatchScraper.ts --focus complexity --think-hard

# 依存関係マッピング
/sc:analyze src/services/PatchScraper.ts --focus dependencies --scope module

# リファクタリング対象の特定
/sc:analyze src/services/PatchScraper.ts --focus responsibilities --ultrathink
```

### 1.2 アーキテクチャ設計

```bash
# クラス分離設計
/sc:design services/scrapers/ --focus architecture --persona-architect

# インターフェース設計
/sc:design services/scrapers/ --focus interfaces --type api

# 依存関係設計
/sc:design services/scrapers/ --focus dependencies --validate
```

## Phase 2: 実装 (6-8時間)

### 2.1 基盤クラス作成

```bash
# ImageValidator作成（最もシンプル）
/sc:implement services/scrapers/ImageValidator.ts --type service --focus validation

# ScraperDebugger作成（デバッグ専用）
/sc:implement services/scrapers/ScraperDebugger.ts --type service --focus debugging

# HtmlParser作成（DOM解析専用）
/sc:implement services/scrapers/HtmlParser.ts --type service --focus parsing --complexity high
```

### 2.2 メインクラス リファクタリング

```bash
# PatchScraper.tsのリファクタリング
/sc:refactor src/services/PatchScraper.ts --focus responsibilities --persona-refactorer

# 依存関係注入の実装
/sc:refactor src/services/PatchScraper.ts --focus dependencies --validate
```

### 2.3 統合・修正

```bash
# TypeScriptコンパイルエラー修正
/sc:fix src/services/scrapers/ --focus typescript --validate

# ESLint警告修正
/sc:fix src/services/scrapers/ --focus linting --persona-refactorer

# インポート文整理
/sc:cleanup src/services/scrapers/ --focus imports
```

## Phase 3: テスト作成 (4-6時間)

### 3.1 ユニットテスト作成

```bash
# HtmlParser テスト作成
/sc:test unit --target src/services/scrapers/HtmlParser.ts --coverage 95

# ImageValidator テスト作成  
/sc:test unit --target src/services/scrapers/ImageValidator.ts --coverage 100

# ScraperDebugger テスト作成
/sc:test unit --target src/services/scrapers/ScraperDebugger.ts --coverage 100
```


### 3.2 統合テスト

```bash
# 統合テスト作成
/sc:test integration --target src/services/PatchScraper.ts --focus collaboration

# エラーケーステスト
/sc:test edge-cases --target src/services/scrapers/ --focus error-handling
```

### 3.3 テストカバレッジ検証

```bash
# カバレッジ測定
/sc:test coverage --target src/services/scrapers/ --threshold 95

# 未カバー行の特定と改善
/sc:improve src/services/scrapers/ --focus test-coverage --loop
```

## Phase 4: 品質保証・ドキュメント (2-3時間)

### 4.1 コード品質チェック

```bash
# 全体的な品質チェック
/sc:analyze src/services/scrapers/ --focus quality --persona-qa

# パフォーマンス検証
/sc:analyze src/services/scrapers/ --focus performance --validate

# セキュリティチェック
/sc:analyze src/services/scrapers/ --focus security --persona-security
```

### 4.2 ドキュメント作成

```bash
# アーキテクチャドキュメント
/sc:document src/services/scrapers/ --type architecture --style detailed

# API仕様書作成
/sc:document src/services/scrapers/ --type api --style detailed

# クラス図生成
/sc:document src/services/scrapers/ --type diagram --focus relationships
```

### 4.3 最終検証

```bash
# 全体統合テスト
/sc:test e2e --target src/services/PatchScraper.ts --validate

# 本番環境テスト準備
/sc:build --target src/services/scrapers/ --environment production --validate
```

## Phase 5: デプロイ・検証 (1-2時間)

### 5.1 最終ビルド

```bash
# プロダクションビルド
/sc:build --environment production --validate --focus scrapers

# 型チェック
npm run lint && npm run build
```

### 5.2 動作検証

```bash
# 機能テスト
/sc:test functional --target src/services/PatchScraper.ts --scenario real-world

# パフォーマンステスト
/sc:test performance --target src/services/scrapers/ --baseline current
```

## 高度なコマンドパターン

### デバッグモード付きリファクタリング

```bash
# デバッグ情報付きで段階実行
/sc:refactor src/services/PatchScraper.ts --debug --step-by-step --validate

# 環境変数制御の実装
/sc:implement environmental-debug --target src/services/scrapers/ --focus logging
```

### 継続的改善

```bash
# 段階的改善（反復実行）
/sc:improve src/services/scrapers/ --loop --iterations 3 --focus quality

# パフォーマンス最適化
/sc:optimize src/services/scrapers/ --focus performance --validate
```

### エラー対応

```bash
# 問題診断
/sc:troubleshoot src/services/scrapers/ --focus integration --think

# 修正候補提案
/sc:fix src/services/scrapers/ --suggest --focus compatibility
```

## 実行時チェックリスト

### Phase 1完了チェック
- [ ] 既存コード複雑性分析完了
- [ ] 4クラス分離設計完了
- [ ] インターフェース定義完了
- [ ] 依存関係マッピング完了

### Phase 2完了チェック
- [ ] ImageValidator.ts実装完了
- [ ] ScraperDebugger.ts実装完了  
- [ ] HtmlParser.ts実装完了
- [ ] PatchScraper.tsリファクタリング完了
- [ ] TypeScriptエラー0件
- [ ] ESLint警告0件

### Phase 3完了チェック
- [ ] 43テストケース実装完了
- [ ] テストカバレッジ>95%達成
- [ ] 全テストパス
- [ ] エッジケーステスト完了

### Phase 4完了チェック
- [ ] アーキテクチャドキュメント作成
- [ ] API仕様書作成
- [ ] クラス図作成
- [ ] 品質メトリクス検証

### Phase 5完了チェック
- [ ] プロダクションビルド成功
- [ ] 機能テストパス
- [ ] パフォーマンステストパス
- [ ] デプロイ準備完了

## 品質ゲート

各フェーズで以下の品質基準を満たすこと：

```bash
# 品質ゲート検証コマンド
/sc:validate src/services/scrapers/ --gates quality --threshold 95
/sc:validate src/services/scrapers/ --gates performance --baseline 
/sc:validate src/services/scrapers/ --gates security --strict
```

### 必須品質メトリクス
- テストカバレッジ: >95%
- ESLintエラー: 0件
- TypeScriptエラー: 0件
- 循環複雑度: <10
- 関数行数: <50行

## トラブルシューティング

### よくある問題と対処

```bash
# import.metaエラー対応
/sc:fix src/utils/logger.ts --focus esm-compatibility

# Cheerio型定義エラー
/sc:fix src/services/scrapers/ --focus typescript --focus cheerio

# Jest mock設定
/sc:fix test/setup.ts --focus jest-config --focus mocking
```

## 自動化スクリプト

### 全フェーズ自動実行

```bash
# リファクタリング全体自動実行（注意：高リスク）
/sc:workflow refactoring-full --target src/services/PatchScraper.ts --auto-approve false

# 段階的自動実行（推奨）
/sc:workflow refactoring-phase1 --target src/services/PatchScraper.ts
/sc:workflow refactoring-phase2 --target src/services/PatchScraper.ts  
/sc:workflow refactoring-phase3 --target src/services/PatchScraper.ts
```

## 成功メトリクス

### 完了判定基準

```bash
# 最終検証コマンド
/sc:validate refactoring-complete --target src/services/scrapers/ --report detailed
```

**完了条件**:
- PatchScraper.ts: 680行 → ~340行 (50%削減)
- 新規クラス: 3個 (~450行追加)
- テストカバレッジ: >95%
- 全品質ゲートパス
- ドキュメント完備

---

**作成日**: 2025年1月15日  
**対象バージョン**: TypeScript 5.x, Node.js 18.x  
**実行環境**: Claude Code SuperClaude Framework  
**見積工数**: 18-22時間 (75%信頼区間)