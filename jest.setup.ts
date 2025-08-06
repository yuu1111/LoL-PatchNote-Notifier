/**
 * Jest Setup File
 * テスト環境の初期化設定
 */

// テスト用の環境変数設定
process.env.DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/test/test';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-api-key';
process.env.LOL_PATCH_NOTES_URL = process.env.LOL_PATCH_NOTES_URL || 'https://www.leagueoflegends.com/ja-jp/news/tags/patch-notes/';
process.env.CHECK_INTERVAL_CRON = process.env.CHECK_INTERVAL_CRON || '0 */90 * * * *';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error'; // テスト時はエラーログのみ表示
process.env.NODE_ENV = 'test';

// Consoleログの抑制（必要に応じて）
if (process.env.SUPPRESS_TEST_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// グローバルモックの設定
jest.setTimeout(30000); // タイムアウトを30秒に設定

// Node.js環境でのfetch関連の問題を回避
if (typeof globalThis.fetch === 'undefined') {
  // fetch APIが存在しない場合は何もしない（axiosを使用しているため）
  // これによりundiciモジュールの初期化エラーを回避
}

// TextEncoderとTextDecoderのポリフィル（必要に応じて）
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}