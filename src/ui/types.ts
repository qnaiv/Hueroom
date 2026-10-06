import type { Analysis, ImageFileRef, SortableItem } from '../core/types';

/** 画面に出す画像 1 枚 */
export interface GalleryItem extends SortableItem {
  ref: ImageFileRef;
  analysis?: Analysis;
  /** 解析（デコード）に失敗した画像 */
  failed: boolean;
}
