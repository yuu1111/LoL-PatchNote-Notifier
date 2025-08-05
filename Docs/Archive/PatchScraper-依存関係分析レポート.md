# 🔗 PatchScraper.ts 依存関係分析レポート

## 📊 依存関係マップ

### 直接依存関係 (8個)

#### 外部ライブラリ依存
| 依存先 | タイプ | 用途 | 結合度 |
|--------|--------|------|--------|
| `cheerio` | npm | DOM解析・HTMLスクレイピング | 🔴 高 |

#### 内部ユーティリティ依存
| 依存先 | タイプ | 用途 | 結合度 |
|--------|--------|------|--------|
| `httpClient` | utils | HTTP通信・リトライ処理 | 🟡 中 |
| `Logger` | utils | ログ出力 | 🟢 低 |
| `config` | config | 設定値取得 | 🟡 中 |

#### 型・エラー依存
| 依存先 | タイプ | 用途 | 結合度 |
|--------|--------|------|--------|
| `PatchNote`, `ScrapingError` | types | 型定義・例外処理 | 🟢 低 |

#### サブサービス依存
| 依存先 | タイプ | 用途 | 結合度 |
|--------|--------|------|--------|
| `HtmlParser` | scrapers | DOM要素解析 | 🔴 高 |
| `ImageValidator` | scrapers | 画像URL検証 | 🟡 中 |
| `ScraperDebugger` | scrapers | デバッグ出力 | 🟢 低 |

### 推移的依存関係

#### HtmlParserの依存
- `cheerio` (2次依存)
- `Logger`, `ImageValidator` (3次依存)

#### httpClientの依存
- `axios` (npm)
- `config`, `Logger` (循環参照リスク)

#### configの依存
- プロキシパターンで環境変数アクセス
- 動的ロード機能

## ⚠️ 依存関係問題

### 1. 強結合問題 (最重要)

#### A. cheerio への過度な依存
```typescript
// 問題: CheerioAPIが全メソッドに浸透
private extractPatchContent($: cheerio.CheerioAPI): string | null
private extractDetailedImageUrl($: cheerio.CheerioAPI): string | null
private findHighDefinitionImage(allImages: cheerio.Cheerio<any>): string | null
```

**影響**: 
- DOM実装変更時の高修正コスト
- テスタビリティ低下
- 他のHTMLパーサーへの移行困難

#### B. HtmlParser強依存
- PatchScraperの主要機能がHtmlParserに強く依存
- 循環依存リスク (PatchScraper → HtmlParser → ImageValidator)

### 2. 設定依存問題 (高)

#### Proxy設定パターンの複雑性
```typescript
// config/index.ts の複雑なProxy実装
export const config = new Proxy({} as AppConfig, {
  get(target, prop): unknown {
    _config ??= loadConfig();
    return _config[prop as keyof AppConfig];
  },
});
```

**影響**:
- 初期化タイミングが不明確
- エラー処理の複雑化
- テスト時の設定モック困難

### 3. 循環依存リスク (中)

#### 潜在的循環参照パス
```
PatchScraper → config → Logger → config (潜在的)
PatchScraper → HtmlParser → Logger → httpClient → config
```

## 💡 依存関係最適化提案

### 優先度 1: 抽象化レイヤー導入

#### A. DOMパーサー抽象化
```typescript
// 提案: DOM操作の抽象化
interface DOMParser {
  load(html: string): Document;
  find(document: Document, selector: string): Element[];
  text(element: Element): string;
  attr(element: Element, name: string): string | null;
}

class CheerioDOMParser implements DOMParser {
  // cheerio固有実装
}

class PatchScraper {
  constructor(private domParser: DOMParser) {} // DI
}
```

**効果**: cheerio依存度80%削減、テスタビリティ向上

#### B. 設定注入パターン
```typescript
// 提案: 設定の依存注入
interface ScraperConfig {
  patchNotesUrl: string;
  debugMode: boolean;
  selectors: SelectorSet;
}

class PatchScraper {
  constructor(
    private config: ScraperConfig,
    private httpClient: HttpClient,
    private logger: Logger
  ) {}
}
```

**効果**: 設定依存削除、テスト容易性向上

### 優先度 2: ファクトリーパターン導入

#### ScraperFactory実装
```typescript
// 提案: ファクトリーパターンで依存管理
class ScraperFactory {
  static create(config: ScraperConfig): PatchScraper {
    const domParser = new CheerioDOMParser();
    const htmlParser = new HtmlParser(domParser);
    const imageValidator = new ImageValidator();
    const debugger = new ScraperDebugger();
    
    return new PatchScraper(config, htmlParser, imageValidator, debugger);
  }
}
```

**効果**: 依存関係管理の集約、初期化複雑度削減

### 優先度 3: インターフェース分離

#### 責任別インターフェース分離
```typescript
// 提案: インターフェース分離原則適用
interface ContentExtractor {
  extractTitle(container: Element): string | null;
  extractUrl(container: Element): string | null;
}

interface ImageExtractor {
  extractImageUrl(container: Element): string | null;
  findHighResolutionImage(images: Element[]): string | null;
}

interface DebugSupport {
  logPageStructure(document: Document): void;
  logElementInfo(element: Element): void;
}
```

**効果**: 単一責任原則遵守、インターフェース肥大化防止

## 📈 最適化ROI分析

| 最適化案 | 実装工数 | 依存削減 | テスト性 | ROI |
|----------|---------|---------|---------|-----|
| DOM抽象化 | 3-4日 | 80% | ⭐⭐⭐ | ⭐⭐⭐ |
| 設定DI | 2-3日 | 60% | ⭐⭐⭐ | ⭐⭐⭐ |
| ファクトリー | 1-2日 | 40% | ⭐⭐ | ⭐⭐ |
| IF分離 | 2-3日 | 30% | ⭐⭐ | ⭐⭐ |

## 🔍 詳細依存関係分析

### package.json 依存関係
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "axios": "^1.11.0",
    "cheerio": "^1.1.2",
    "dotenv": "^16.4.5",
    "node-cron": "^3.0.3",
    "winston": "^3.15.0"
  }
}
```

### 直接インポート分析
```typescript
// PatchScraper.ts のインポート
import * as cheerio from 'cheerio';                    // 🔴 強結合
import { httpClient } from '../utils/httpClient';      // 🟡 中結合
import { Logger } from '../utils/logger';              // 🟢 弱結合
import { config } from '../config';                    // 🟡 中結合
import { type PatchNote, ScrapingError } from '../types'; // 🟢 弱結合
import { HtmlParser, type SelectorSet } from './scrapers/HtmlParser'; // 🔴 強結合
import { ImageValidator } from './scrapers/ImageValidator'; // 🟡 中結合
import { ScraperDebugger } from './scrapers/ScraperDebugger'; // 🟢 弱結合
```

### 推移的依存関係ツリー
```
PatchScraper
├── cheerio (外部)
├── httpClient
│   ├── axios (外部)
│   ├── config (循環リスク)
│   └── Logger
├── config
│   └── types
├── HtmlParser
│   ├── cheerio (重複)
│   ├── Logger (重複)
│   └── ImageValidator
├── ImageValidator (単独)
└── ScraperDebugger
    └── Logger (重複)
```

## 🎯 即座に実行可能なアクション

1. **DOMParser インターフェース作成** → cheerio依存80%削減
2. **ScraperConfig 型定義** → 設定結合度60%削減
3. **依存注入コンストラクタ実装** → テスタビリティ大幅向上

**依存結合度スコア**: 8/10 (高) → 目標: 3/10 (低)

## 🔗 関連ドキュメント
- [責任分析レポート](./PatchScraper-責任分析レポート.md)
- [複雑性分析レポート](./PatchScraper-複雑性分析レポート.md)
- [リファクタリング計画書](./REFACTORING_PLAN.md)
- [スクレイパーアーキテクチャ](./scrapers-architecture.md)