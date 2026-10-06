import type { ImageFileRef } from '../core/types';

/**
 * 選択したフォルダ。中身（native）はアダプタだけが解釈する。
 * Web: FileSystemDirectoryHandle または File[]、Android: SAF のツリー URI、
 * iOS: security-scoped bookmark、PC: ディレクトリパス。
 */
export interface FolderHandle {
  readonly name: string;
  readonly native: unknown;
}

export type RestoreResult =
  | { status: 'ok'; folder: FolderHandle }
  /** 保存済みだが、ユーザー操作（クリック）の中で許可を求める必要がある */
  | { status: 'needs-permission'; folderName: string; request(): Promise<FolderHandle | null> }
  | { status: 'none' };

export interface ListOptions {
  /** サブフォルダも含める */
  recursive: boolean;
  signal?: AbortSignal;
}

/**
 * 「フォルダから画像一覧を取得する処理」をプラットフォーム別に分離するためのインターフェース。
 * 表示・色抽出・ソートはこれだけに依存する共通コード。
 */
export interface FolderAdapter {
  /** ピッカーを開いてフォルダを選ぶ。キャンセルは null */
  pickFolder(): Promise<FolderHandle | null>;
  /** 前回のフォルダを復元する（許可の再確認を含む） */
  restoreLast(): Promise<RestoreResult>;
  /** 画像（jpg/jpeg/png/webp/gif）を順に列挙する */
  listImages(folder: FolderHandle, opts: ListOptions): AsyncIterable<ImageFileRef>;
  /** PC 版向け: フォルダの変更監視。戻り値で解除 */
  watch?(folder: FolderHandle, onChange: () => void): () => void;
  readonly capabilities: {
    /** 次回起動時にフォルダを覚えていられるか */
    persistent: boolean;
    watch: boolean;
  };
}
