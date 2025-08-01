/**
 * パッチ取得テスター
 * 指定したパッチバージョンでスクレイピング機能をテスト
 */

import 'dotenv/config';
import { PatchScraper } from './services/PatchScraper';
import { StateManager } from './services/StateManager';
import { ImageDownloader } from './services/ImageDownloader';
import { Logger } from './utils/logger';

class PatchTester {
  private patchScraper: PatchScraper;
  private stateManager: StateManager;
  private imageDownloader: ImageDownloader;

  constructor() {
    this.patchScraper = new PatchScraper();
    this.stateManager = new StateManager();
    this.imageDownloader = new ImageDownloader();
  }

  /**
   * 指定したバージョンのパッチノートを取得・保存テスト
   */
  async testPatchVersion(version: string): Promise<void> {
    try {
      Logger.info(`🧪 パッチ ${version} の取得テストを開始`);

      const patchUrl = `https://www.leagueoflegends.com/ja-jp/news/game-updates/patch-${version.replace('.', '-')}-notes`;
      Logger.info(`📋 対象URL: ${patchUrl}`);

      // 個別ページから詳細情報を取得
      const detailedInfo = await this.patchScraper.scrapeDetailedPatch(patchUrl);

      if (!detailedInfo.content && !detailedInfo.imageUrl) {
        Logger.error(`❌ パッチ ${version} のデータ取得に失敗`);
        return;
      }

      // 画像ダウンロードテスト
      let localImagePath: string | undefined;
      if (detailedInfo.imageUrl) {
        try {
          Logger.info(`🖼️ 画像ダウンロードテスト開始...`);
          localImagePath = await this.imageDownloader.downloadPatchImage(
            detailedInfo.imageUrl,
            version
          );
          Logger.info(`✅ 画像ダウンロード成功: ${localImagePath}`);
        } catch (imageError) {
          Logger.error(`❌ 画像ダウンロード失敗:`, imageError);
        }
      }

      // パッチノートオブジェクトを作成
      const patchNote = {
        version: version,
        title: `パッチノート ${version}`,
        url: patchUrl,
        publishedAt: new Date(),
        ...(detailedInfo.content && { content: detailedInfo.content }),
        ...(detailedInfo.imageUrl && { imageUrl: detailedInfo.imageUrl }),
        ...(localImagePath && { localImagePath })
      };

      Logger.info(`✅ パッチデータ取得成功:`);
      Logger.info(`   • 本文: ${patchNote.content ? `${patchNote.content.length}文字` : 'なし'}`);
      Logger.info(`   • 画像: ${patchNote.imageUrl ? 'あり' : 'なし'}`);
      Logger.info(`   • ローカル画像: ${localImagePath ? 'あり' : 'なし'}`);

      // JSONファイル保存テスト
      try {
        Logger.info(`💾 パッチデータ保存テスト開始...`);
        await this.stateManager.savePatchDetails(patchNote);
        Logger.info(`✅ パッチデータ保存成功: patches/patch_${version}/patch_${version}.json`);
      } catch (saveError) {
        Logger.error(`❌ パッチデータ保存失敗:`, saveError);
      }

      Logger.info(`🎯 パッチ ${version} のテスト完了`);

    } catch (error) {
      Logger.error(`❌ パッチ ${version} のテスト中にエラー:`, error);
    }
  }

  /**
   * 複数バージョンをテスト
   */
  async testMultipleVersions(versions: string[]): Promise<void> {
    Logger.info(`🎯 ${versions.length}個のパッチバージョンをテスト開始`);

    for (const version of versions) {
      await this.testPatchVersion(version);
      Logger.info(`⏳ 次のテストまで2秒待機...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    Logger.info(`🏁 全バージョンのテスト完了`);
  }

  /**
   * パッチ一覧ページから利用可能なパッチを検出
   */
  async detectAvailablePatches(): Promise<string[]> {
    try {
      Logger.info(`🔍 パッチ一覧ページから利用可能なパッチを検出中...`);

      const latestPatch = await this.patchScraper.scrapeLatestPatch();
      if (!latestPatch) {
        Logger.error('❌ パッチ一覧の取得に失敗');
        return [];
      }

      // 現在のバージョンから過去3バージョンを生成
      const currentVersion = latestPatch.version;
      const versions = this.generateVersionList(currentVersion, 3);

      Logger.info(`📋 検出されたパッチバージョン: ${versions.join(', ')}`);
      return versions;

    } catch (error) {
      Logger.error('❌ パッチ検出中にエラー:', error);
      return [];
    }
  }

  /**
   * バージョンリストを生成（現在から過去N個）
   */
  private generateVersionList(currentVersion: string, count: number): string[] {
    const versions: string[] = [];
    const parts = currentVersion.split('.');

    if (parts.length >= 2 && parts[0] && parts[1]) {
      const major = parseInt(parts[0]);
      let minor = parseInt(parts[1]);

      for (let i = 0; i < count; i++) {
        versions.push(`${major}.${minor}`);
        minor--;
        if (minor < 1) break; // 25.1より前は考慮しない
      }
    }

    return versions;
  }

  /**
   * 保存済みパッチデータの確認
   */
  async verifySavedPatch(version: string): Promise<void> {
    try {
      Logger.info(`🔍 パッチ ${version} の保存データを確認中...`);

      const fs = await import('fs/promises');
      const path = await import('path');

      const patchDir = path.join(process.cwd(), 'patches', `patch_${version}`);
      const jsonFile = path.join(patchDir, `patch_${version}.json`);
      const imageFile = path.join(patchDir, `patch_${version}.jpg`);

      // JSONファイルの確認
      try {
        const jsonContent = await fs.readFile(jsonFile, 'utf8');
        const patchData = JSON.parse(jsonContent);
        Logger.info(`✅ JSONファイル確認成功:`);
        Logger.info(`   • タイトル: ${patchData.title}`);
        Logger.info(`   • 本文長: ${patchData.content ? `${patchData.content.length}文字` : 'なし'}`);
        Logger.info(`   • 画像URL: ${patchData.imageUrl ? 'あり' : 'なし'}`);
      } catch (jsonError) {
        Logger.error(`❌ JSONファイル読み込み失敗: ${jsonError}`);
      }

      // 画像ファイルの確認
      try {
        const imageStats = await fs.stat(imageFile);
        Logger.info(`✅ 画像ファイル確認成功: ${Math.round(imageStats.size / 1024)}KB`);
      } catch (imageError) {
        Logger.warn(`⚠️ 画像ファイルが見つかりません: ${imageFile}`);
      }

    } catch (error) {
      Logger.error(`❌ 保存データ確認中にエラー:`, error);
    }
  }
}

// メイン実行部分
if (require.main === module) {
  const tester = new PatchTester();

  const args = process.argv.slice(2);
  const command = args[0];
  const version = args[1];

  switch (command) {
    case 'test':
      if (version) {
        tester.testPatchVersion(version);
      } else {
        console.log('使用方法: npm run patch-test test <version>');
        console.log('例: npm run patch-test test 25.14');
      }
      break;

    case 'multi':
      const versions = args.slice(1);
      if (versions.length > 0) {
        tester.testMultipleVersions(versions);
      } else {
        tester.testMultipleVersions(['25.15', '25.14']);
      }
      break;

    case 'detect':
      tester.detectAvailablePatches();
      break;

    case 'verify':
      if (version) {
        tester.verifySavedPatch(version);
      } else {
        console.log('使用方法: npm run patch-test verify <version>');
      }
      break;

    default:
      console.log('🎯 LoL Patch Tester');
      console.log('');
      console.log('使用方法:');
      console.log('  npm run patch-test test 25.14    # 特定バージョンをテスト');
      console.log('  npm run patch-test multi 25.15 25.14  # 複数バージョンをテスト');
      console.log('  npm run patch-test detect        # 利用可能なパッチを検出');
      console.log('  npm run patch-test verify 25.14  # 保存済みデータを確認');
      break;
  }
}