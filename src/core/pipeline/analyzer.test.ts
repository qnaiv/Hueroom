import { describe, expect, it } from 'vitest';
import type { AnalysisCache } from '../cache/analysisCache';
import { imageKey } from '../keys';
import type { Analysis, ImageFileRef } from '../types';
import { analyzeImages } from './analyzer';
import type { Extractor } from './extractor';

const analysis = (hex: string): Analysis => ({
  color: { L: 0.5, a: 0, b: 0, C: 0, H: 0, hex },
  thumb: new Blob(['t']),
});

const ref = (name: string, fail = false): ImageFileRef => ({
  path: name,
  name,
  lastModified: 1,
  size: 1,
  getFile: async () => {
    if (fail) throw new Error('読めない');
    return new Blob([name]);
  },
});

function memoryCache(initial: Record<string, Analysis> = {}): AnalysisCache & { map: Map<string, Analysis> } {
  const map = new Map(Object.entries(initial));
  return { map, get: async (k) => map.get(k), getMany: async (ks) => ks.map((k) => map.get(k)), set: async (k, v) => void map.set(k, v) };
}

function fakeExtractor(concurrency = 2) {
  const calls: string[] = [];
  let active = 0;
  let maxActive = 0;
  const extractor: Extractor = {
    concurrency,
    async extract(blob) {
      calls.push(await blob.text());
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return analysis('#123456');
    },
    dispose() {},
  };
  return { extractor, calls, stats: () => ({ maxActive }) };
}

describe('analyzeImages', () => {
  it('キャッシュにあるものは再計算せず、無いものだけ解析して保存する', async () => {
    const refs = [ref('a.jpg'), ref('b.jpg'), ref('c.jpg')];
    const cache = memoryCache({ [imageKey(refs[0]!)]: analysis('#aaaaaa') });
    const { extractor, calls } = fakeExtractor();
    const got = new Map<string, Analysis | null>();
    await analyzeImages(refs, { cache, extractor }, { onResult: (r, _k, a) => void got.set(r.name, a) });
    expect(calls.sort()).toEqual(['b.jpg', 'c.jpg']);
    expect(got.get('a.jpg')?.color.hex).toBe('#aaaaaa');
    expect(got.get('b.jpg')?.color.hex).toBe('#123456');
    expect(cache.map.size).toBe(3);
  });

  it('同時実行数が Extractor の並列度を超えない', async () => {
    const refs = Array.from({ length: 12 }, (_, i) => ref(`f${i}.jpg`));
    const { extractor, stats } = fakeExtractor(3);
    await analyzeImages(refs, { cache: memoryCache(), extractor }, { onResult() {} });
    expect(stats().maxActive).toBeLessThanOrEqual(3);
    expect(stats().maxActive).toBeGreaterThan(1);
  });

  it('読み込めないファイルは null として扱い、残りの処理を続ける。進捗は最後に total になる', async () => {
    const refs = [ref('ok.jpg'), ref('bad.jpg', true), ref('ok2.jpg')];
    const { extractor } = fakeExtractor();
    const results: Record<string, Analysis | null> = {};
    let last = [0, 0];
    await analyzeImages(
      refs,
      { cache: memoryCache(), extractor },
      { onResult: (r, _k, a) => void (results[r.name] = a), onProgress: (d, t) => void (last = [d, t]) },
    );
    expect(results['bad.jpg']).toBeNull();
    expect(results['ok2.jpg']).not.toBeNull();
    expect(last).toEqual([3, 3]);
  });

  it('中断すると、以降の画像は処理しない', async () => {
    const refs = Array.from({ length: 20 }, (_, i) => ref(`f${i}.jpg`));
    const { extractor, calls } = fakeExtractor(1);
    const ctrl = new AbortController();
    await analyzeImages(
      refs,
      { cache: memoryCache(), extractor },
      { onResult: (_r, _k, _a) => void (calls.length >= 3 && ctrl.abort()) },
      ctrl.signal,
    );
    expect(calls.length).toBeLessThan(20);
  });
});
