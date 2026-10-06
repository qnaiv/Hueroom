import { describe, expect, it } from 'vitest';
import { oklchToOklab } from '../color/oklab';
import type { SortableItem } from '../types';
import { hueBandIndex, sortByColor, totalStepDistance } from './hueBands';

function item(key: string, L: number, C: number, H: number): SortableItem {
  return { key, name: key, lastModified: 0, shotAt: 0, color: { ...oklchToOklab(L, C, H), C, H } };
}

/** 決定的な疑似乱数 */
function rng(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function sample(n: number, grayRatio = 0.1): SortableItem[] {
  const r = rng(7);
  return Array.from({ length: n }, (_, i) => {
    const gray = r() < grayRatio;
    return item(`i${i}`, 0.2 + r() * 0.75, gray ? r() * 0.02 : 0.06 + r() * 0.2, r() * 360);
  });
}

describe('hueBandIndex', () => {
  it('赤（H=0）が帯 0 の中央に来て、360 度で折り返す', () => {
    expect(hueBandIndex(0, 12)).toBe(0);
    expect(hueBandIndex(359, 12)).toBe(0);
    expect(hueBandIndex(14, 12)).toBe(0);
    expect(hueBandIndex(16, 12)).toBe(1);
    expect(hueBandIndex(180, 12)).toBe(6);
  });
});

describe('sortByColor', () => {
  it('入力を変更せず、全件をちょうど 1 回ずつ返す', () => {
    const src = sample(300);
    const copy = [...src];
    const out = sortByColor(src);
    expect(src).toEqual(copy);
    expect(out).toHaveLength(src.length);
    expect(new Set(out.map((x) => x.key)).size).toBe(src.length);
  });

  it('無彩色は末尾にまとまり、明度の高い順に並ぶ', () => {
    const out = sortByColor(sample(300, 0.3));
    const firstGray = out.findIndex((x) => x.color!.C < 0.04);
    expect(firstGray).toBeGreaterThan(0);
    const tail = out.slice(firstGray);
    expect(tail.every((x) => x.color!.C < 0.04)).toBe(true);
    for (let i = 1; i < tail.length; i++) {
      expect(tail[i - 1]!.color!.L).toBeGreaterThanOrEqual(tail[i]!.color!.L);
    }
  });

  it('未解析の画像は最後に置く', () => {
    const pending: SortableItem = { key: 'p', name: 'p', lastModified: 0, shotAt: 0 };
    const out = sortByColor([pending, ...sample(20)]);
    expect(out[out.length - 1]).toBe(pending);
  });

  it('色相帯は順番に並び、各帯の中の色相は同じ帯に収まる', () => {
    const out = sortByColor(sample(400, 0)).map((x) => hueBandIndex(x.color!.H, 12));
    for (let i = 1; i < out.length; i++) expect(out[i]!).toBeGreaterThanOrEqual(out[i - 1]!);
  });

  it('帯ごとに明暗の向きを折り返す（偶数帯は暗→明、奇数帯は明→暗の側から始まる）', () => {
    // 帯 0 と帯 1 に、明度が十分離れた 2 点ずつを置く
    const items = [
      item('a-dark', 0.3, 0.15, 0), item('a-light', 0.9, 0.15, 5),
      item('b-dark', 0.3, 0.15, 30), item('b-light', 0.9, 0.15, 35),
    ];
    const keys = sortByColor(items).map((x) => x.key);
    expect(keys.slice(0, 2)).toEqual(['a-dark', 'a-light']);
    expect(keys.slice(2)).toEqual(['b-light', 'b-dark']);
  });

  it('帯の境界で、明度順だけで並べるより色の飛びが小さい', () => {
    const src = sample(600, 0);
    const bandsOnly = [...src].sort(
      (p, q) => hueBandIndex(p.color!.H, 12) - hueBandIndex(q.color!.H, 12) || p.color!.L - q.color!.L,
    );
    expect(totalStepDistance(sortByColor(src))).toBeLessThan(totalStepDistance(bandsOnly));
  });

  it('帯内の最近傍法は、同じ帯の明度順より隣同士の色差の合計が小さい', () => {
    const src = sample(250, 0).filter((x) => hueBandIndex(x.color!.H, 12) === 3);
    expect(src.length).toBeGreaterThan(5);
    const byL = [...src].sort((p, q) => p.color!.L - q.color!.L);
    expect(totalStepDistance(sortByColor(src))).toBeLessThan(totalStepDistance(byL));
  });

  it('空・1 枚・全て無彩色でも動く', () => {
    expect(sortByColor([])).toEqual([]);
    const one = [item('x', 0.5, 0.1, 100)];
    expect(sortByColor(one)).toEqual(one);
    expect(sortByColor([item('g1', 0.2, 0, 0), item('g2', 0.8, 0, 0)]).map((x) => x.key)).toEqual(['g2', 'g1']);
  });

  it('帯が大きすぎるときは明度順にフォールバックする', () => {
    const src = sample(200, 0).map((x) => ({ ...x, color: { ...x.color!, H: 10 } }));
    const out = sortByColor(src, { maxNearest: 10 });
    for (let i = 1; i < out.length; i++) expect(out[i - 1]!.color!.L).toBeLessThanOrEqual(out[i]!.color!.L);
  });

  it('同じ入力には同じ結果を返す', () => {
    const src = sample(200);
    expect(sortByColor(src).map((x) => x.key)).toEqual(sortByColor(src).map((x) => x.key));
  });
});
