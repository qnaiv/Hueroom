import { kv, type KV } from '../storage/idb';
import type { Analysis } from '../types';

/**
 * 解析結果の形式の版。Analysis に項目を足したとき（例: 撮影日時、構図、質感、配色）に上げる。
 * 古い版の保存データは無かったものとして扱い、再解析して上書きする。
 *
 * 版 6 は、配色だけを持つ公開版（PR のプレビュー）と、構図・質感・配色をすべて持つ版の 2 通りで使われた。
 * プレビューと本番は同じ保存場所を共有するので、後者が前者のデータを読んで落ちた。そこで 7 に上げ、
 * あわせて、版が合っていても項目が足りないデータは使わない（isComplete）ようにした。
 */
export const ANALYSIS_VERSION = 7;

type Stored = Analysis & { version: number };

/** 主要色・サムネイル・撮影日時・ハッシュのキャッシュ。キーは cacheKey()（名前＋サイズ＋更新日時。パスは含めない） */
export interface AnalysisCache {
  get(key: string): Promise<Analysis | undefined>;
  getMany(keys: readonly string[]): Promise<(Analysis | undefined)[]>;
  set(key: string, value: Analysis): Promise<void>;
}

const isNum = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

/** 画面が使う項目がそろっているか。版の食い違いで項目が足りないデータを、落ちる前に弾く */
function isComplete(v: Stored): boolean {
  const { color, palette, composition: c, tone: t, thumb } = v;
  return (
    !!color &&
    Array.isArray(palette) &&
    palette.length > 0 &&
    !!c &&
    [c.space, c.detail, c.cx, c.cy, c.vertical, c.symmetry].every(isNum) &&
    !!t &&
    [t.brightness, t.contrast, t.saturation].every(isNum) &&
    thumb instanceof Blob
  );
}

const current = (v: Stored | undefined): Analysis | undefined =>
  v && v.version === ANALYSIS_VERSION && isComplete(v) ? v : undefined;

export function createAnalysisCache(dbName?: string): AnalysisCache {
  const store: KV<Stored> = kv<Stored>('analysis', dbName);
  return {
    get: async (k) => current(await store.get(k)),
    getMany: async (ks) => (await store.getMany(ks)).map(current),
    set: (k, v) => store.set(k, { ...v, version: ANALYSIS_VERSION }),
  };
}
