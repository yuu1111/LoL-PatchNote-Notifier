# League of Legends パッチ通知システム 🎮

League of Legendsの公式パッチノートサイトを自動監視し、新しいパッチがリリースされた際にAI生成の要約付きでDiscordに豊富な通知を送信するインテリジェントなTypeScript/Node.jsシステムです。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2%2B-blue.svg)](https://www.typescriptlang.org/)

## 🚀 機能

### 🤖 AI駆動の要約機能
- **Gemini AI統合**: パッチノートの包括的な日本語要約を自動生成
- **主要変更点の抽出**: 各パッチで最も重要な変更を特定してハイライト
- **スマートキャッシュ**: 7日間のキャッシュシステムで不要なAPI呼び出しを回避し、コストを削減

### 📱 豊富なDiscord通知
- **拡張エンベッド**: パッチタイトル、バージョン、リンクを含む美しいDiscord通知
- **AI要約統合**: 生成された要約と主要変更点を通知に含める
- **画像サポート**: パッチ画像を自動ダウンロードして埋め込み
- **重複防止**: 賢い状態管理で重複通知を防止

### 🔄 堅牢な監視システム
- **スケジュール監視**: 設定可能な間隔でのチェック（デフォルト: 60分）
- **フォールバックセレクタ**: 複数のCSSセレクタでWebサイト構造変更に対応
- **リトライロジック**: HTTP失敗時の指数バックオフ（2秒、4秒、8秒）
- **サーキットブレーカー**: 障害時のカスケード障害を防止

### 💾 データ管理
- **ローカルキャッシュ**: 信頼性のためにパッチデータと画像をローカル保存
- **状態永続化**: JSONベースの状態管理でアプリケーション再起動に対応
- **整理されたストレージ**: 各パッチは独自のディレクトリにメタデータと共に保存

## 🏗️ アーキテクチャ

```
src/
├── app.ts                    # メインアプリケーションエントリポイント & スケジューラ
├── config/index.ts           # 環境変数 & 設定
├── services/
│   ├── PatchScraper.ts       # HTMLスクレイピング & データ抽出
│   ├── DiscordNotifier.ts    # Discord Webhook通知
│   ├── GeminiSummarizer.ts   # AI駆動パッチ要約
│   ├── ImageDownloader.ts    # 画像ダウンロード & キャッシュ
│   ├── StateManager.ts       # 状態永続化 & 管理
│   └── Scheduler.ts          # Cronベーススケジューリング
├── utils/
│   ├── logger.ts             # Winstonログシステム
│   ├── httpClient.ts         # リトライロジック付きAxios HTTPクライアント
│   └── fileStorage.ts        # JSONファイル永続化ユーティリティ
└── types/index.ts            # TypeScript型定義

patches/                      # データ永続化ディレクトリ
├── patch_25.15/              # 個別パッチディレクトリ
│   ├── patch_25.15.json      # パッチデータとメタデータ
│   ├── patch_25.15.jpg       # キャッシュされたパッチ画像
│   └── patch_25.15_summary.json # AI生成要約
└── last_patch_status.json    # 状態追跡ファイル
```

## 🚀 クイックスタート

### 前提条件
- Node.js 18+ と npm 8+
- Discord Webhook URL
- Google Gemini APIキー

### インストール

1. **リポジトリをクローン**
   ```bash
   git clone https://github.com/yuu1111/LoL-PatchNote-Notifier.git
   cd LoL-Patch-Notifier
   ```

2. **依存関係をインストール**
   ```bash
   npm install
   ```

3. **環境変数を設定**
   ```bash
   cp .env.example .env
   ```
   
   `.env`を編集して設定を行う:
   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   GEMINI_MAX_TOKENS=25000
   LOG_LEVEL=info
   CHECK_INTERVAL_MINUTES=60
   ```

4. **ビルドして実行**
   ```bash
   npm run build
   npm start
   ```

### 開発

```bash
# 自動リロード付き開発
npm run dev

# 型チェック & リンティング
npm run typecheck
npm run lint
npm run format

# テスト
npm test
npm run test:coverage

# ユーティリティ
npm run patch-test    # パッチ検出テスト
npm run kill         # 実行中のインスタンスを停止
npm run reset-state  # アプリケーション状態をリセット
```

## ⚙️ 設定

### 環境変数

| 変数 | 説明 | デフォルト | 必須 |
|------|------|-----------|------|
| `DISCORD_WEBHOOK_URL` | 通知用Discord Webhook URL | - | ✅ |
| `GEMINI_API_KEY` | AI要約用Google Gemini APIキー | - | ✅ |
| `GEMINI_MODEL` | 使用するGeminiモデル | `gemini-2.5-flash` | ❌ |
| `GEMINI_MAX_TOKENS` | AI生成の最大トークン | `25000` | ❌ |
| `GEMINI_TEMPERATURE` | AI生成温度 (0.0-1.0) | `0.3` | ❌ |
| `GEMINI_TIMEOUT` | APIリクエストタイムアウト (ms) | `60000` | ❌ |
| `GEMINI_MAX_RETRIES` | 最大リトライ回数 | `3` | ❌ |
| `LOL_PATCH_NOTES_URL` | LoLパッチノートURL | JP公式サイト | ❌ |
| `CHECK_INTERVAL_MINUTES` | 監視間隔（分） | `60` | ❌ |
| `LOG_LEVEL` | ログレベル (debug/info/warn/error) | `info` | ❌ |
| `NODE_ENV` | 環境 (development/production) | `development` | ❌ |

### コスト見積もり

Gemini 2.5 Flash価格での計算:
- **パッチ要約ごと**: 約$0.0015 (¥0.23)
- **月間コスト**: 約$0.003 (¥0.5) 月2パッチの場合
- **年間コスト**: 約$0.036 (¥5.5)

## 🐳 デプロイ

### Dockerデプロイ
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["npm", "start"]
```

### 推奨デプロイオプション

1. **AWS Lambda + EventBridge** (推奨)
   - スケジュールトリガー付きサーバーレス
   - 実行ごとの従量課金
   - 自動スケーリングと高可用性

2. **Docker + Kubernetes CronJob**
   - コンテナベースデプロイ
   - リソース管理とスケーリング
   - 組み込み監視とログ

3. **Platform-as-a-Service**
   - Render、Fly.io、Railway
   - 組み込みcron付きシンプルデプロイ
   - 管理されたインフラ

## 🔧 技術スタック

### コア依存関係
- **[@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)** `^0.24.1` - Gemini AI統合
- **[axios](https://www.npmjs.com/package/axios)** `^1.6.0` - リトライロジック付きHTTPクライアント
- **[cheerio](https://www.npmjs.com/package/cheerio)** `^1.0.0-rc.12` - サーバーサイドHTML解析
- **[winston](https://www.npmjs.com/package/winston)** `^3.11.0` - 構造化ログ
- **[node-cron](https://www.npmjs.com/package/node-cron)** `^3.0.3` - タスクスケジューリング
- **[dotenv](https://www.npmjs.com/package/dotenv)** `^16.3.0` - 環境設定

### 開発ツール
- **TypeScript** `^5.2.0` - 型安全JavaScript
- **ESLint + Prettier** - コード品質とフォーマット
- **Jest** `^29.7.0` - テストフレームワーク
- **tsx** `^4.20.3` - TypeScript実行とウォッチモード

## 📊 監視 & パフォーマンス

### サービスレベル指標 (SLI)
- **成功率**: 99.5% 目標
- **応答時間**: パッチ検出で2秒未満
- **エラー率**: 重要な操作で0.1%未満
- **可用性**: 99.9% 稼働時間目標

### ログ & 可観測性
- **構造化ログ**: タイムスタンプベースログディレクトリ付きWinston
- **エラー追跡**: コンテキスト付き包括的エラーハンドリング
- **パフォーマンスメトリクス**: 応答時間と成功率
- **リソース使用量**: 256MBメモリフットプリント向け設計

## 🤝 コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'feat: Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを開く

### 開発標準
- **セマンティックコミット**: 慣例的コミット形式を使用 (`feat:`, `fix:`, `refactor:`)
- **セマンティックバージョニング**: リリースにsemverを従う (MAJOR.MINOR.PATCH)
- **コード品質**: 一貫したフォーマットのためのESLint + Prettier
- **テスト**: 重要な機能のテストカバレッジを維持

## 📝 ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🔗 関連リンク

- [League of Legends 公式パッチノート](https://www.leagueoflegends.com/ja-jp/news/tags/patch-notes)
- [Discord Webhook ドキュメント](https://discord.com/developers/docs/resources/webhook)
- [Google Gemini API ドキュメント](https://ai.google.dev/docs)

## 📞 サポート

問題が発生した場合や質問がある場合:

1. [Issues](https://github.com/yuu1111/LoL-PatchNote-Notifier/issues)ページを確認
2. `logs/`ディレクトリのログを確認
3. 環境変数が正しく設定されていることを確認
4. Discord WebhookとGemini APIキーが有効であることを確認

---

**League of Legendsコミュニティのために❤️を込めて作成**