import type { AnalysisCache } from '../cache/analysisCache';
import { imageKey } from '../keys';
import type { Analysis, ImageFileRef } from '../types';
import type { Extractor } from './extractor';

export interface AnalyzeCallbacks {
  /** 1 枚ぶんの結果。解析できなかった画像は analysis が null */
  onResult(ref: ImageFileRef, key: string, analysis: Analysis | null): void;
  onProgress?(done: number, total: number): void;
}

/**
 * 画像の解析を非同期・逐次で進める。
 * まずキャッシュを引き、無いものだけを Extractor（Worker プール）に渡す。
 * signal で中断できる（フォルダを切り替えたときなど）。
 */
export async function analyzeImages(
  refs: readonly ImageFileRef[],
  deps: { cache: AnalysisCache; extractor: Extractor },
  cb: AnalyzeCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const total = refs.length;
  let done = 0;
  const finish = (ref: ImageFileRef, key: string, a: Analysis | null) => {
    done++;
    cb.onResult(ref, key, a);
    cb.onProgress?.(done, total);
  };

  // 1. キャッシュの確認（一定数ずつ並行）
  const misses: { ref: ImageFileRef; key: string }[] = [];
  const LOOKUP_BATCH = 32;
  for (let i = 0; i < refs.length; i += LOOKUP_BATCH) {
    if (signal?.aborted) return;
    const chunk = refs.slice(i, i + LOOKUP_BATCH);
    const hits = await Promise.all(
      chunk.map(async (ref) => {
        const key = imageKey(ref);
        return { ref, key, hit: await deps.cache.get(key).catch(() => undefined) };
      }),
    );
    for (const { ref, key, hit } of hits) {
      if (hit) finish(ref, key, hit);
      else misses.push({ ref, key });
    }
  }

  // 2. 未解析のものを、Extractor の並列度ぶんずつ処理する
  let next = 0;
  const worker = async () => {
    while (!signal?.aborted) {
      const job = misses[next++];
      if (!job) return;
      let result: Analysis | null = null;
      try {
        result = await deps.extractor.extract(await job.ref.getFile());
      } catch {
        result = null; // 読み込めないファイルは飛ばして続ける
      }
      if (signal?.aborted) return;
      if (result) await deps.cache.set(job.key, result).catch(() => undefined);
      finish(job.ref, job.key, result);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, deps.extractor.concurrency) }, worker));
}
