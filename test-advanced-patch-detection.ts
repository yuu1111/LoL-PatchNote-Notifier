/**
 * 改良版パッチ検出システムのテスト
 */

import 'dotenv/config';
import { App } from './src/app';
import { Logger } from './src/utils/logger';

async function testAdvancedPatchDetection() {
  try {
    Logger.info('🧪 改良版パッチ検出システムのテストを開始します...');
    
    const app = new App();
    
    // 健全性チェック
    const isHealthy = await app.healthCheck();
    if (!isHealthy) {
      Logger.error('❌ 健全性チェックに失敗しました');
      return;
    }
    
    Logger.info('✅ 健全性チェック完了');
    
    // 改良版パッチ検出を実行
    Logger.info('🔍 改良版パッチ検出を実行中...');
    await app.checkForPatchesAdvanced();
    
    Logger.info('✅ 改良版パッチ検出テスト完了');
    
  } catch (error) {
    Logger.error('❌ テスト中にエラーが発生しました:', error);
  }
}

// テスト実行
if (require.main === module) {
  testAdvancedPatchDetection()
    .then(() => {
      Logger.info('🎉 テスト完了');
      process.exit(0);
    })
    .catch((error) => {
      Logger.error('💥 テスト失敗:', error);
      process.exit(1);
    });
}