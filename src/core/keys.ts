import type { ImageFileRef } from './types';

/**
 * 色キャッシュとお気に入りで共通のキー。
 * 同名ファイルが別フォルダにあっても衝突しないよう相対パスを使い、
 * 更新日時とサイズで内容の変化を検出する。
 */
export function imageKey(ref: Pick<ImageFileRef, 'path' | 'lastModified' | 'size'>): string {
  return `${ref.path}|${ref.lastModified}|${ref.size}`;
}
