import type { ImageFileRef } from './types';

/**
 * 画面の中で画像を区別するキー（React の key や、解析結果の置き場所）。
 * パスを含むので、同じフォルダの中では必ず一意になる。保存はしない。
 */
export function imageKey(ref: Pick<ImageFileRef, 'path' | 'lastModified' | 'size'>): string {
  return `${ref.path}|${ref.lastModified}|${ref.size}`;
}

/**
 * 解析キャッシュを引くためのキー。
 * パスを含めないので、上の階層を選び直したり、別のフォルダへ移したりしても、
 * 名前・サイズ・更新日時が同じなら解析結果（サムネイル・主要色）を使い回せる。
 */
export function cacheKey(ref: Pick<ImageFileRef, 'name' | 'lastModified' | 'size'>): string {
  return `${ref.name}|${ref.size}|${ref.lastModified}`;
}

/**
 * お気に入りの識別子。画像の中身の SHA-256（解析時に計算）を使うので、
 * 名前の変更・移動・コピーをしても同じ画像として引き継がれる。
 * ハッシュを計算できなかった画像は、cacheKey で代用する。
 */
export function favoriteId(ref: Pick<ImageFileRef, 'name' | 'lastModified' | 'size'>, hash: string | undefined): string {
  return hash ?? `q:${cacheKey(ref)}`;
}
