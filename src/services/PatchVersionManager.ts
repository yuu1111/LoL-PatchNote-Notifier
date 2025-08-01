/**
 * パッチバージョン管理サービス
 * パッチ一覧ページから利用可能なパッチを検出し、新しいパッチを特定
 */

import { PatchScraper } from './PatchScraper';
import { Logger } from '../utils/logger';
import { PatchNote } from '../types';

export interface PatchVersionInfo {
  version: string;
  isAvailable: boolean;
  url: string;
  isNew: boolean;
}

export class PatchVersionManager {
  private patchScraper: PatchScraper;
  private knownVersions: Set<string> = new Set();

  constructor() {
    this.patchScraper = new PatchScraper();
  }

  /**
   * パッチ一覧ページから利用可能なパッチバージョンを検出
   */
  async detectAvailablePatches(): Promise<PatchVersionInfo[]> {
    try {
      Logger.info('🔍 パッチ一覧ページから利用可能なパッチを検出中...');
      
      const latestPatch = await this.patchScraper.scrapeLatestPatch();
      if (!latestPatch) {
        Logger.error('❌ パッチ一覧の取得に失敗');
        return [];
      }

      const currentVersion = latestPatch.version;
      Logger.info(`📋 最新パッチ: ${currentVersion}`);

      // 現在のバージョンから過去のバージョンを生成
      const versions = this.generatePatchVersions(currentVersion, 5);
      const patchInfos: PatchVersionInfo[] = [];

      for (const version of versions) {
        const patchInfo: PatchVersionInfo = {
          version,
          isAvailable: await this.checkPatchAvailability(version),
          url: this.generatePatchUrl(version),
          isNew: !this.knownVersions.has(version)
        };
        
        patchInfos.push(patchInfo);
        Logger.debug(`パッチ ${version}: 利用可能=${patchInfo.isAvailable}, 新規=${patchInfo.isNew}`);
      }

      // 利用可能なバージョンを既知のバージョンに追加
      patchInfos
        .filter(info => info.isAvailable)
        .forEach(info => this.knownVersions.add(info.version));

      const availableCount = patchInfos.filter(info => info.isAvailable).length;
      const newCount = patchInfos.filter(info => info.isNew && info.isAvailable).length;
      
      Logger.info(`✅ パッチ検出完了: 利用可能=${availableCount}個, 新規=${newCount}個`);
      
      return patchInfos;
      
    } catch (error) {
      Logger.error('❌ パッチバージョン検出中にエラー:', error);
      return [];
    }
  }

  /**
   * 新しいパッチが検出されたかチェック
   */
  async checkForNewPatches(): Promise<PatchNote[]> {
    try {
      Logger.info('🔍 新しいパッチをチェック中...');
      
      const patchInfos = await this.detectAvailablePatches();
      const newPatches = patchInfos.filter(info => info.isNew && info.isAvailable);
      
      if (newPatches.length === 0) {
        Logger.info('📝 新しいパッチは見つかりませんでした');
        return [];
      }

      Logger.info(`🆕 ${newPatches.length}個の新しいパッチを発見!`);
      
      const newPatchNotes: PatchNote[] = [];
      
      for (const patchInfo of newPatches) {
        try {
          Logger.info(`📥 パッチ ${patchInfo.version} の詳細を取得中...`);
          
          const detailedInfo = await this.patchScraper.scrapeDetailedPatch(patchInfo.url);
          
          const patchNote: PatchNote = {
            version: patchInfo.version,
            title: `パッチノート ${patchInfo.version}`,
            url: patchInfo.url,
            publishedAt: new Date(),
            ...(detailedInfo.content && { content: detailedInfo.content }),
            ...(detailedInfo.imageUrl && { imageUrl: detailedInfo.imageUrl })
          };
          
          newPatchNotes.push(patchNote);
          Logger.info(`✅ パッチ ${patchInfo.version} の詳細取得完了`);
          
        } catch (patchError) {
          Logger.error(`❌ パッチ ${patchInfo.version} の詳細取得に失敗:`, patchError);
        }
      }
      
      return newPatchNotes;
      
    } catch (error) {
      Logger.error('❌ 新しいパッチチェック中にエラー:', error);
      return [];
    }
  }

  /**
   * 特定バージョンのパッチが利用可能かチェック
   */
  private async checkPatchAvailability(version: string): Promise<boolean> {
    try {
      const url = this.generatePatchUrl(version);
      const detailedInfo = await this.patchScraper.scrapeDetailedPatch(url);
      
      // コンテンツまたは画像が取得できれば利用可能と判定
      return !!(detailedInfo.content || detailedInfo.imageUrl);
      
    } catch (error) {
      Logger.debug(`パッチ ${version} は利用不可: ${error}`);
      return false;
    }
  }

  /**
   * パッチバージョンリストを生成
   */
  private generatePatchVersions(currentVersion: string, count: number): string[] {
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
   * パッチURLを生成
   */
  private generatePatchUrl(version: string): string {
    return `https://www.leagueoflegends.com/ja-jp/news/game-updates/patch-${version.replace('.', '-')}-notes`;
  }

  /**
   * 既知のバージョンを初期化
   */
  initializeKnownVersions(versions: string[]): void {
    this.knownVersions = new Set(versions);
    Logger.info(`📚 既知のパッチバージョンを初期化: ${versions.join(', ')}`);
  }

  /**
   * 既知のバージョンを取得
   */
  getKnownVersions(): string[] {
    return Array.from(this.knownVersions).sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      
      // メジャーバージョン比較
      if (aParts[0] && bParts[0] && aParts[0] !== bParts[0]) {
        return bParts[0] - aParts[0]; // 降順
      }
      
      // マイナーバージョン比較
      if (aParts[1] && bParts[1]) {
        return bParts[1] - aParts[1]; // 降順
      }
      
      return 0;
    });
  }

  /**
   * バージョン情報をリセット
   */
  resetVersionInfo(): void {
    this.knownVersions.clear();
    Logger.info('🔄 パッチバージョン情報をリセットしました');
  }
}