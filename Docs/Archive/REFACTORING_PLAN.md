# リファクタリング計画書

## 概要
このドキュメントは、LoL Patch Notifierプロジェクトのリファクタリング計画と実行ガイドです。

## SuperClaude コマンドガイド

リファクタリング作業には以下のSuperClaudeコマンドを活用してください：

### 分析・調査コマンド（コピペ用）
```bash
# コード品質分析とリファクタリング候補の特定
/sc:analyze src/services/PatchScraper.ts --focus quality --depth deep

# 特定のコード部分の詳細説明
/sc:explain src/services/PatchScraper.ts の責務と複雑性について

# 問題の根本原因調査
/sc:troubleshoot PatchScraperクラスが大きすぎる問題
```

### 実装コマンド（コピペ用）
```bash
# 新しいクラスや機能の実装
/sc:implement src/services/scrapers/HtmlParser.ts - PatchScraperからDOM解析ロジックを分離

# 既存コードの改善とリファクタリング
/sc:improve src/services/PatchScraper.ts --refactor --persona-refactorer

# 不要なコードの削除と整理
/sc:cleanup src/services/PatchScraper.ts のデバッグログメソッド
```

### 品質保証コマンド（コピペ用）
```bash
# テストの作成と実行
/sc:test unit --target src/services/scrapers/HtmlParser.ts

# ドキュメントの生成
/sc:document src/services/scrapers/ のクラス図とAPI仕様

# 作業量の見積もり
/sc:estimate PatchScraper.tsのリファクタリング作業
```

### 便利なフラグの組み合わせ例
```bash
# 複雑な分析時
/sc:analyze src/services/ --think --focus architecture

# 変更前の検証付きリファクタリング
/sc:improve src/services/PatchScraper.ts --validate --safe-mode

# リファクタリング専門モードで実行
/sc:improve src/services/ --persona-refactorer --think-hard
```

## リファクタリング対象と優先順位

### 🔴 Phase 1: 最優先 - PatchScraper.ts の分解（推定: 4-6時間）

**現状の問題点**:
- 680行の巨大クラス
- 18個のメソッド（責務過多）
- デバッグログ機能の混在
- 画像検索ロジックの重複

**リファクタリング計画**:

```typescript
// 現在の構造
PatchScraper
├── scrapeLatestPatch()
├── scrapeDetailedPatch()
├── extractPatchContent()
├── extractDetailedImageUrl()
├── findHighDefinitionImage()
├── findHighResolutionCdnImage()
├── findImageBySelectorFallback()
├── debugLogPageStructure()
├── debugLogPatchElement()
└── ... (その他多数のメソッド)

// リファクタリング後の構造
PatchScraper (メインクラス: ~200行)
├── scrapeLatestPatch()
├── scrapeDetailedPatch()
└── 他のクラスへの委譲

HtmlParser (DOM解析専門: ~150行)
├── findElement()
├── extractTitle()
├── extractUrl()
└── extractImageUrl()

ImageExtractor (画像抽出専門: ~150行)
├── findHighDefinitionImage()
├── findHighResolutionCdnImage()
├── findImageBySelectorFallback()
└── isValidImageUrl()

ScraperDebugger (デバッグ専門: ~100行)
├── logPageStructure()
├── logPatchElement()
├── logGridContainers()
└── logContainerImages()
```

**実行手順（コピペ用コマンド）**:
```bash
# Step 1: DOM解析クラスの作成
/sc:implement src/services/scrapers/HtmlParser.ts - CheerioAPIを使用したDOM解析専用クラス。findElement, extractTitle, extractUrl, extractImageUrlメソッドを実装

# Step 2: 画像抽出クラスの作成
/sc:implement src/services/scrapers/ImageExtractor.ts - 画像URL検索と検証専用クラス。findHighDefinitionImage, findHighResolutionCdnImage, findImageBySelectorFallback, isValidImageUrlメソッドを実装

# Step 3: デバッグクラスの作成
/sc:implement src/services/scrapers/ScraperDebugger.ts - スクレイピングデバッグ専用クラス。logPageStructure, logPatchElement, logGridContainers, logContainerImagesメソッドを実装

# Step 4: メインクラスのリファクタリング
/sc:improve src/services/PatchScraper.ts --refactor --think --safe-mode - 作成したクラスを使用してPatchScraperをリファクタリング。HtmlParser, ImageExtractor, ScraperDebuggerに処理を委譲

# Step 5: ユニットテストの作成
/sc:test unit --target src/services/scrapers/HtmlParser.ts src/services/scrapers/ImageExtractor.ts src/services/scrapers/ScraperDebugger.ts

# Step 6: 統合テストの更新
/sc:improve src/services/PatchScraper.test.ts --update - リファクタリング後のPatchScraperに合わせてテストを更新
```

### 🟡 Phase 2: 中優先 - 共通ユーティリティの作成（推定: 2-3時間）

**作成するユーティリティ**:

1. **SelectorFinder** - セレクタベースの検索統一化
```typescript
class SelectorFinder {
  static findFirst($: CheerioAPI, selectors: string[]): Element | null
  static findAll($: CheerioAPI, selectors: string[]): Element[]
  static findWithFallback($: CheerioAPI, selectorSets: SelectorSet): Element | null
}
```

2. **ErrorHandler** - エラーハンドリングの統一
```typescript
class ErrorHandler {
  static handle(error: unknown, context: string): void
  static wrap<T>(fn: () => Promise<T>, context: string): Promise<T>
  static createError(type: ErrorType, message: string): AppError
}
```

3. **Constants** - 定数管理の改善
```typescript
// src/constants/index.ts
export const HTTP_STATUS = {
  OK_MIN: 200,
  OK_MAX: 300,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500
} as const;

export const LIMITS = {
  MAX_DEBUG_CLASSES: 20,
  MAX_FIELD_LENGTH: 1021,
  RETRY_ATTEMPTS: 3
} as const;
```

**実行手順（コピペ用コマンド）**:
```bash
# Step 1: セレクタユーティリティ作成
/sc:implement src/utils/SelectorFinder.ts - CheerioAPIでのセレクタ検索を統一化するユーティリティクラス。findFirst, findAll, findWithFallbackメソッドを実装

# Step 2: エラーハンドラー作成
/sc:implement src/utils/ErrorHandler.ts - アプリケーション全体のエラーハンドリングを統一化。handle, wrap, createErrorメソッドを実装。Discord通知連携も含む

# Step 3: 定数ファイル作成
/sc:implement src/constants/index.ts - HTTP_STATUS, LIMITS, COLORS, TIMEOUTSなどの定数を一元管理。TypeScriptのconstアサーションを使用

# Step 4: マジックナンバーの置換
/sc:improve src/**/*.ts --focus "マジックナンバーをconstants/index.tsの定数に置換" --validate

# Step 5: 既存コードの更新
/sc:improve src/services/PatchScraper.ts src/services/DiscordNotifier.ts --focus "SelectorFinderとErrorHandlerを使用するように更新"
```

### 🟢 Phase 3: 軽優先 - 各サービスクラスの改善（推定: 3-4時間）

**対象と改善内容**:

1. **GeminiSummarizer.ts**
   - PromptBuilder クラスへのプロンプト生成ロジック分離
   - レート制限ロジックの改善

2. **StateManager.ts**
   - FileRepository クラスへのファイルI/O分離
   - ビジネスロジックの純粋化

3. **DiscordNotifier.ts**
   - EmbedBuilder クラスの作成
   - 定数の外部化

**実行手順（コピペ用コマンド）**:

#### GeminiSummarizer.ts の改善
```bash
# Step 1: 現状分析
/sc:analyze src/services/GeminiSummarizer.ts --focus quality --depth deep

# Step 2: プロンプトビルダー作成
/sc:implement src/services/ai/PromptBuilder.ts - Gemini AI用のプロンプト生成専用クラス。buildSummaryPrompt, buildKeyChangesPrompt, buildNewFeaturesPromptメソッドを実装

# Step 3: GeminiSummarizerのリファクタリング
/sc:improve src/services/GeminiSummarizer.ts --refactor --focus "PromptBuilderクラスを使用してプロンプト生成ロジックを分離"

# Step 4: テスト作成
/sc:test unit --target src/services/ai/PromptBuilder.ts src/services/GeminiSummarizer.ts
```

#### StateManager.ts の改善
```bash
# Step 1: ファイルリポジトリ作成
/sc:implement src/repositories/FileRepository.ts - ファイルI/O操作を抽象化。read, write, exists, deleteメソッドを実装。JSONの読み書きに特化

# Step 2: StateManagerのリファクタリング
/sc:improve src/services/StateManager.ts --refactor --focus "FileRepositoryを使用してファイルI/Oロジックを分離"

# Step 3: テスト更新
/sc:improve tests/services/StateManager.test.ts --update - FileRepositoryのモックを使用するように更新
```

#### DiscordNotifier.ts の改善
```bash
# Step 1: Embedビルダー作成
/sc:implement src/services/discord/EmbedBuilder.ts - Discord Embed構築専用クラス。createPatchEmbed, addSummaryFields, addListFieldメソッドを実装

# Step 2: DiscordNotifierのリファクタリング
/sc:improve src/services/DiscordNotifier.ts --refactor --focus "EmbedBuilderクラスを使用してEmbed構築ロジックを分離"

# Step 3: 定数の外部化
/sc:improve src/services/DiscordNotifier.ts --focus "定数をconstants/discord.tsに移動"
```

## 品質チェックリスト

各フェーズ完了時に以下のコマンドを実行：

```bash
# 基本的な品質チェック
npm run lint           # ESLintエラーがないこと
npm run build          # TypeScriptコンパイルが通ること
npm test               # 既存のテストが全て通ること

# 品質メトリクスの確認
/sc:analyze src/services/ --focus quality --depth deep

# 複雑度チェック（循環的複雑度が10以下であること）
/sc:analyze src/services/**/*.ts --focus "cyclomatic complexity"

# ファイルサイズチェック（各クラスが300行以下であること）
/sc:analyze src/services/**/*.ts --focus "file size and method length"

# テストカバレッジ確認
npm run test:coverage
```

### チェック項目
- [ ] ESLintエラーがないこと
- [ ] TypeScriptコンパイルが通ること
- [ ] 既存のテストが全て通ること
- [ ] 新規作成したクラスにテストがあること
- [ ] 循環的複雑度が10以下であること
- [ ] 各クラスが300行以下であること
- [ ] 各メソッドが50行以下であること

## リスク管理

### 想定されるリスク
1. **機能の破損**: 大規模なリファクタリングによる既存機能への影響
   - 対策: 段階的な実装とテストの充実

2. **パフォーマンス低下**: クラス分割によるオーバーヘッド
   - 対策: パフォーマンステストの実施

3. **統合の複雑化**: 分割したクラス間の連携
   - 対策: 明確なインターフェース定義

### ロールバック計画

```bash
# 各フェーズ開始前にGitブランチを作成
git checkout -b refactor/phase1-patchscraper
git checkout -b refactor/phase2-utilities
git checkout -b refactor/phase3-services

# 問題発生時は即座に前のバージョンに戻す
git checkout main
git branch -D refactor/phase1-patchscraper

# 安全なロールバック
/sc:git --operation rollback --branch refactor/phase1-patchscraper
```

## 成功指標

リファクタリング完了時の目標：

- **コード品質**
  - 各クラス10メソッド以下
  - 各メソッド50行以下
  - 循環的複雑度10以下

- **保守性**
  - 単一責任の原則の遵守
  - 高凝集・疎結合の実現
  - テストカバレッジ80%以上

- **パフォーマンス**
  - 既存の処理速度を維持
  - メモリ使用量の増加を5%以内に抑制

## 実行スケジュール案

### Day 1: Phase 1 - PatchScraper.ts の分解
```bash
# 朝: ブランチ作成と分析
git checkout -b refactor/phase1-patchscraper
/sc:analyze src/services/PatchScraper.ts --think-hard --persona-refactorer

# 午前: 新クラスの実装
/sc:implement src/services/scrapers/HtmlParser.ts - CheerioAPIを使用したDOM解析専用クラス
/sc:implement src/services/scrapers/ImageExtractor.ts - 画像URL検索と検証専用クラス

# 午後: リファクタリング実行
/sc:improve src/services/PatchScraper.ts --refactor --validate --safe-mode

# 夕方: テストとコミット
npm run lint && npm run build && npm test
git add -A && git commit -m "refactor: PatchScraperを責務ごとに分割"
```

### Day 2: Phase 2 - 共通ユーティリティの作成
```bash
# 朝: ブランチ作成
git checkout -b refactor/phase2-utilities

# 午前: ユーティリティ実装
/sc:implement src/utils/SelectorFinder.ts - セレクタ検索統一化
/sc:implement src/utils/ErrorHandler.ts - エラーハンドリング統一化
/sc:implement src/constants/index.ts - 定数一元管理

# 午後: 既存コードの更新
/sc:improve src/**/*.ts --focus "新しいユーティリティを使用するように更新"

# 夕方: テストとコミット
npm run quality:check
git add -A && git commit -m "feat: 共通ユーティリティを追加し、既存コードを更新"
```

### Day 3: Phase 3 - 各サービスクラスの改善
```bash
# 朝: ブランチ作成
git checkout -b refactor/phase3-services

# 各サービスの改善（並行実行可能）
/sc:improve src/services/GeminiSummarizer.ts --refactor --persona-refactorer
/sc:improve src/services/StateManager.ts --refactor --persona-refactorer
/sc:improve src/services/DiscordNotifier.ts --refactor --persona-refactorer

# 夕方: 統合テスト
npm run test:integration
git add -A && git commit -m "refactor: 各サービスクラスの責務を分離"
```

### Day 4: 統合テストと最終調整
```bash
# 朝: 全ブランチのマージ準備
git checkout main
git merge refactor/phase1-patchscraper
git merge refactor/phase2-utilities
git merge refactor/phase3-services

# 統合テストの実行
/sc:test integration --comprehensive
npm run test:e2e

# パフォーマンス測定
/sc:analyze src/ --focus performance --compare-with main

# 最終チェック
/sc:analyze src/ --focus quality --comprehensive
npm run quality:check

# リリース準備
git tag -a v2.0.0 -m "Major refactoring: improved code quality and maintainability"
```

## 次のステップ

### 即座に開始できるコマンド

```bash
# 1. このプランのレビュー
/sc:analyze REFACTORING_PLAN.md --validate

# 2. 現在の品質ベースラインを記録
/sc:analyze src/ --focus quality > quality-baseline.md

# 3. Phase 1の開始
git checkout -b refactor/phase1-patchscraper
/sc:implement src/services/scrapers/HtmlParser.ts - CheerioAPIを使用したDOM解析専用クラス。findElement, extractTitle, extractUrl, extractImageUrlメソッドを実装

# 4. 進捗の可視化
/sc:task リファクタリング進捗 --create --phases 3
```

### 緊急時のコマンド

```bash
# ビルドが壊れた場合
/sc:troubleshoot "npm run buildが失敗する"

# テストが失敗した場合
/sc:troubleshoot "テストが失敗: [エラーメッセージ]"

# マージコンフリクトが発生した場合
/sc:git --operation resolve-conflict --files [ファイルパス]
```

---

*このドキュメントは随時更新されます。最新の状態は `/sc:analyze REFACTORING_PLAN.md` で確認してください。*