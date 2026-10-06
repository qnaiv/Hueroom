import type { Analysis, ImageFileRef, SortableItem } from '../core/types';

/** 画面に出す画像 1 枚 */
export interface GalleryItem extends SortableItem {
  ref: ImageFileRef;
  analysis?: Analysis;
  /** 解析（デコード）に失敗した画像 */
  failed: boolean;
  /** shotAt が EXIF の撮影日時なら true（false なら更新日時で代用している） */
  shotFromExif: boolean;
  /** お気に入りの識別子（画像の中身のハッシュ）。解析が終わるまでは undefined */
  favoriteId?: string;
}

/** お気に入りかどうか。お気に入りは画像の中身で識別するので、解析が終わるまでは false */
export const isFavorite = (item: GalleryItem, favorites: ReadonlySet<string>): boolean =>
  item.favoriteId !== undefined && favorites.has(item.favoriteId);
