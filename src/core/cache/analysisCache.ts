import { kv, type KV } from '../storage/idb';
import type { Analysis } from '../types';

/** 主要色とサムネイルのキャッシュ。キーは imageKey()（パス＋更新日時＋サイズ） */
export interface AnalysisCache {
  get(key: string): Promise<Analysis | undefined>;
  set(key: string, value: Analysis): Promise<void>;
}

export function createAnalysisCache(dbName?: string): AnalysisCache {
  const store: KV<Analysis> = kv<Analysis>('analysis', dbName);
  return { get: (k) => store.get(k), set: (k, v) => store.set(k, v) };
}
