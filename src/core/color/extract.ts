import { EXIF_HEAD_BYTES, readExifDate } from '../exif';
import type { Analysis } from '../types';
import { dominantFromRgba } from './quantize';

/** 色抽出に使う縮小サイズ */
export const SAMPLE_SIZE = 32;
/** サムネイル（正方形）の一辺 */
export const THUMB_SIZE = 224;

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

interface Surface {
  ctx: Ctx2D;
  source: CanvasImageSource;
  toBlob(type: string, quality: number): Promise<Blob>;
}

/** Worker では OffscreenCanvas、使えない環境では通常の canvas を使う */
function createSurface(size: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(size, size);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d コンテキストを取得できません');
    return { ctx, source: c, toBlob: (type, quality) => c.convertToBlob({ type, quality }) };
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d コンテキストを取得できません');
  return {
    ctx,
    source: c,
    toBlob: (type, quality) =>
      new Promise((resolve, reject) =>
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('サムネイルの生成に失敗'))), type, quality),
      ),
  };
}

/**
 * 画像 1 枚から、主要色とサムネイルを同時に作る。
 * 中央を正方形に切り出した 224px を作り、そこから 32×32 に縮小して色を求める
 * （タイルに実際に見えている範囲の色になる）。デコードできない画像は null。
 */
export async function analyzeBlob(blob: Blob): Promise<Analysis | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    const thumb = createSurface(THUMB_SIZE);
    const scale = Math.max(THUMB_SIZE / bitmap.width, THUMB_SIZE / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    thumb.ctx.imageSmoothingQuality = 'high';
    thumb.ctx.drawImage(bitmap, (THUMB_SIZE - w) / 2, (THUMB_SIZE - h) / 2, w, h);

    const small = createSurface(SAMPLE_SIZE);
    small.ctx.imageSmoothingQuality = 'high';
    small.ctx.drawImage(thumb.source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = small.ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const color = dominantFromRgba(data);
    if (!color) return null;

    let blobOut = await thumb.toBlob('image/webp', 0.8);
    // webp を書き出せない環境（Safari など）では jpeg にする
    if (blobOut.type !== 'image/webp') blobOut = await thumb.toBlob('image/jpeg', 0.8);
    // 撮影日時は、JPEG の先頭だけを読んで取り出す
    let shotAt: number | undefined;
    try {
      shotAt = readExifDate(await blob.slice(0, EXIF_HEAD_BYTES).arrayBuffer());
    } catch {
      shotAt = undefined;
    }
    return { color, thumb: blobOut, shotAt };
  } finally {
    bitmap.close();
  }
}
