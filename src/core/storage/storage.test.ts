import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createAnalysisCache } from '../cache/analysisCache';
import { FavoritesStore } from '../cache/favorites';
import { cacheKey, favoriteId, imageKey } from '../keys';

const COMP = { space: 0.5, detail: 0.05, cx: 0.5, cy: 0.5, vertical: 0, symmetry: 0.1 };
const TONE = { brightness: 0.5, contrast: 0.4, saturation: 0.08 };

describe('imageKey', () => {
  it('パス・更新日時・サイズが違えば別のキーになる', () => {
    const base = { path: 'a/b.jpg', lastModified: 1, size: 10 };
    expect(imageKey(base)).toBe(imageKey({ ...base }));
    expect(imageKey(base)).not.toBe(imageKey({ ...base, path: 'c/b.jpg' }));
    expect(imageKey(base)).not.toBe(imageKey({ ...base, lastModified: 2 }));
    expect(imageKey(base)).not.toBe(imageKey({ ...base, size: 11 }));
  });
});

describe('cacheKey / favoriteId', () => {
  const base = { name: 'a.jpg', lastModified: 1, size: 10 };
  it('cacheKey はパスを含まない（階層が変わっても同じ）', () => {
    expect(cacheKey(base)).toBe(cacheKey({ ...base }));
    expect(cacheKey({ ...base, name: 'b.jpg' })).not.toBe(cacheKey(base));
    expect(cacheKey({ ...base, size: 11 })).not.toBe(cacheKey(base));
    expect(cacheKey({ ...base, lastModified: 2 })).not.toBe(cacheKey(base));
  });
  it('お気に入りの識別子は、ハッシュがあればハッシュ、無ければ cacheKey で代用する', () => {
    expect(favoriteId(base, 'abc123')).toBe('abc123');
    expect(favoriteId(base, undefined)).toBe(`q:${cacheKey(base)}`);
    // 名前や更新日時が変わっても、中身（ハッシュ）が同じなら同じ識別子
    expect(favoriteId({ ...base, name: 'moved.jpg', lastModified: 99 }, 'abc123')).toBe('abc123');
  });
});

describe('analysisCache', () => {
  it('保存した解析結果を取り出せる。未保存は undefined', async () => {
    const cache = createAnalysisCache('t-cache');
    const value = { color: { L: 0.5, a: 0.1, b: 0.1, C: 0.14, H: 45, hex: '#aa5533' }, composition: COMP, tone: TONE, thumb: new Blob(['x']) };
    expect(await cache.get('k')).toBeUndefined();
    await cache.set('k', value);
    const got = await cache.get('k');
    expect(got?.color).toEqual(value.color);
    expect(got?.thumb.size).toBe(1);
    const many = await cache.getMany(['k', 'nope', 'k']);
    expect(many.map((x) => x?.color.hex)).toEqual(['#aa5533', undefined, '#aa5533']);
  });
});

describe('analysisCache の版', () => {
  it('古い版（撮影日時の導入前）の保存データは、無かったものとして扱う', async () => {
    const { kv } = await import('./idb');
    await kv<unknown>('analysis', 't-ver').set('old', { color: { hex: '#000000' }, thumb: new Blob(['x']) });
    const cache = createAnalysisCache('t-ver');
    expect(await cache.get('old')).toBeUndefined();
    expect(await cache.getMany(['old'])).toEqual([undefined]);
    // 新しく保存すると、撮影日時つきで読める
    await cache.set('old', { color: { L: 0, a: 0, b: 0, C: 0, H: 0, hex: '#000000' }, composition: COMP, tone: TONE, thumb: new Blob(['y']), shotAt: 123 });
    expect((await cache.get('old'))?.shotAt).toBe(123);
  });
});

describe('FavoritesStore', () => {
  it('切り替えが保存され、読み直しても残る', async () => {
    const a = new FavoritesStore('t-fav');
    expect(await a.toggle('x|1|2')).toBe(true);
    expect(await a.toggle('y|1|2')).toBe(true);
    expect(await a.toggle('x|1|2')).toBe(false);
    const b = new FavoritesStore('t-fav');
    expect([...(await b.load())]).toEqual(['y|1|2']);
    expect(b.has('y|1|2')).toBe(true);
    expect(b.has('x|1|2')).toBe(false);
  });
});
