# LoL パッチ通知システム

リーグ・オブ・レジェンドの日本語パッチノートを監視し、新しいパッチが公開されたときにDiscordに通知を送信するシステムです。

## 🌟 特徴

- **自動パッチ検出**: 日本語版LoLパッチノートページを定期的に監視
- **Discord通知**: リッチエンベッド形式での美しい通知
- **堅牢な設計**: サーキットブレーカー、リトライ機能、レート制限
- **柔軟な設定**: シンプルな分間隔設定（1-1440分）
- **多重フォールバック**: 複数のCSSセレクターでスクレイピングの確実性を保証
- **プロダクション対応**: 包括的なログ、メトリクス、ヘルスチェック

## 🚀 クイックスタート

### 前提条件

- Node.js 18以上
- npm または pnpm

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/yuu1111/LoL-PatchNote-Notifier.git
cd LoL-PatchNote-Notifier

# 依存関係をインストール
npm install
# または
pnpm install
```

### 設定

1. `.env.example`を`.env`にコピー：
```bash
cp .env.example .env
```

2. `.env`ファイルを編集してDiscord Webhook URLを設定：
```env
# Discord Webhook URL（必須）
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL

# チェック間隔（分単位、デフォルト: 90分）
CHECK_INTERVAL_MINUTES=60

# その他の設定（オプション）
NODE_ENV=development
LOG_LEVEL=info
```

### 実行

```bash
# 開発モード（ホットリロード）
npm run dev

# プロダクションビルド
npm run build
npm start
```

## ⚙️ 設定オプション

### 必須設定

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DISCORD_WEBHOOK_URL` | Discord Webhook URL | `https://discord.com/api/webhooks/...` |

### オプション設定

| 変数名 | 説明 | デフォルト値 | 範囲 |
|--------|------|-------------|------|
| `CHECK_INTERVAL_MINUTES` | チェック間隔（分） | `90` | `1-1440` |
| `NODE_ENV` | 実行環境 | `development` | `development/staging/production` |
| `LOG_LEVEL` | ログレベル | `info` | `debug/info/warn/error` |
| `REQUEST_TIMEOUT_MS` | HTTPタイムアウト | `30000` | `1000-300000` |
| `MAX_RETRIES` | 最大リトライ回数 | `3` | `0-10` |

### 高度な設定

#### サーキットブレーカー
```env
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT_MS=60000
```

#### Redis（プロダクション環境）
```env
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=lol-patch-notifier:
```

## 🏗️ アーキテクチャ

```
src/
├── app.ts                 # メインアプリケーション
├── config/               # 設定管理
│   ├── index.ts          # 設定読み込み
│   └── schemas.ts        # Zodバリデーション
├── services/             # コアサービス
│   ├── PatchScraper.ts   # パッチスクレイピング
│   ├── DiscordNotifier.ts # Discord通知
│   └── PatchMonitor.ts   # 監視オーケストレーション
├── utils/                # ユーティリティ
│   ├── httpClient.ts     # HTTP クライアント
│   ├── logger.ts         # 構造化ログ
│   └── storage.ts        # ストレージ抽象化
└── core/                 # コア定義
    ├── types.ts          # TypeScript型定義
    ├── errors.ts         # カスタムエラー
    └── constants.ts      # 定数
```

## 📊 監視とメトリクス

システムは包括的な監視機能を提供：

- **ヘルスチェック**: `/health` エンドポイント（将来実装）
- **メトリクス**: スクレイピング成功率、通知配信率
- **構造化ログ**: JSON形式でのログ出力
- **サーキットブレーカー**: 障害時の自動復旧

## 🔧 開発

### 利用可能なスクリプト

```bash
npm run dev          # 開発サーバー（ホットリロード）
npm run build        # TypeScriptコンパイル
npm run start        # プロダクション実行
npm run test         # テスト実行
npm run lint         # ESLintチェック
npm run format       # Prettierフォーマット
npm run type-check   # TypeScript型チェック
```

### テスト

```bash
# すべてのテストを実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# UIモードでテスト
npm run test:ui
```

## 🐳 デプロイ

### Docker（将来対応予定）

```dockerfile
# Dockerfile例
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/app.js"]
```

### クラウドプラットフォーム

- **Vercel**: Serverless Functions
- **Railway**: コンテナデプロイ
- **Render**: Web Service
- **AWS Lambda**: Serverless

## 📝 ログ出力例

```json
{
  "level": "info",
  "time": "2024-01-01T00:00:00.000Z",
  "component": "patchMonitor",
  "msg": "New patch detected",
  "patch": {
    "title": "パッチ14.1のお知らせ",
    "url": "https://www.leagueoflegends.com/ja-jp/news/game-updates/patch-14-1/"
  }
}
```

## 🔒 セキュリティ

- Discord Webhook URLの安全な管理
- HTTPSによる安全な通信
- 入力値検証（Zod）
- レート制限による負荷制御
- セキュリティ-focused ESLint設定

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成: `git checkout -b feature/amazing-feature`
3. 変更をコミット: `git commit -m 'Add amazing feature'`
4. ブランチをプッシュ: `git push origin feature/amazing-feature`
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🙏 謝辞

- [Riot Games](https://www.riotgames.com/) - League of Legends
- [Discord](https://discord.com/) - Webhook API
- TypeScriptコミュニティ

## 📞 サポート

問題や質問がある場合は、[Issues](https://github.com/yuu1111/LoL-PatchNote-Notifier/issues)を作成してください。

---

**Made with ❤️ for the League of Legends community**