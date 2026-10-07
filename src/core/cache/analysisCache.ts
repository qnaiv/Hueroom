import { kv, type KV } from '../storage/idb';
import type { Analysis } from '../types';

/**
 * 解析結果の形式の版。Analysis に項目を足したとき（例: 撮影日時、質感）に上げる。
 * 古い版の保存データは無かったものとして扱い、再解析して上書きする。
 */
export const ANALYSIS_VERSION = 5;

type Stored = Analysis & { version: number };

/** 主要色・サムネイル・撮影日時・ハッシュのキャッシュ。キーは cacheKey()（名前＋サイズ＋更新日時。パスは含めない） */
export interface AnalysisCache {
  get(key: string): Promise<Analysis | undefined>;
  getMany(keys: readonly string[]): Promise<(Analysis | undefined)[]>;
  set(key: string, value: Analysis): Promise<void>;
}

const current = (v: Stored | undefined): Analysis | undefined => (v && v.version === ANALYSIS_VERSION ? v : undefined);

export function createAnalysisCache(dbName?: string): AnalysisCache {
  const store: KV<Stored> = kv<Stored>('analysis', dbName);
  return {
    get: async (k) => current(await store.get(k)),
    getMany: async (ks) => (await store.getMany(ks)).map(current),
    set: (k, v) => store.set(k, { ...v, version: ANALYSIS_VERSION }),
  };
}
