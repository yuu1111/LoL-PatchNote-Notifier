/**
 * PatchScraper関連の型定義
 * 外部モジュールで使用される型を定義
 */

import { type SelectorSet } from '../scrapers/HtmlParser';

// Re-export SelectorSet for convenience
export type { SelectorSet } from '../scrapers/HtmlParser';

/**
 * PatchScraperの設定インターフェース
 * 依存性注入時の設定オプション
 */
export interface PatchScraperConfig {
  /** カスタムセレクタセット */
  selectors?: SelectorSet;
  /** デバッグモード有効化 */
  debugMode?: boolean;
  /** 詳細ページ取得のタイムアウト（ミリ秒） */
  detailPageTimeout?: number;
}

/**
 * 詳細ページから取得する情報
 * 内部処理用のインターフェース
 */
export interface DetailedPatchInfo {
  /** ページのメインコンテンツ */
  content?: string;
  /** 高解像度画像のURL */
  imageUrl?: string;
}

/**
 * 抽出されたパッチデータ
 * HTML解析で得られる基本情報
 */
export interface ExtractedPatchData {
  /** パッチのタイトル */
  title: string;
  /** パッチページのURL */
  url: string;
  /** 正規化されたURL */
  normalizedUrl: string;
  /** 画像URL（存在する場合） */
  imageUrl: string | null;
  /** バージョン番号 */
  version: string;
}
