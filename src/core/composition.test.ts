import { describe, expect, it } from 'vitest';
import { compositionFromRgba, compositionTags as tagsWith, spaceThresholds } from './composition';
import type { Composition } from './types';

// 比べる枚数が足りないときの目安（絶対値）で判定する
const compositionTags = (c: Composition) => tagsWith(c, spaceThresholds([]));

const N = 32;

/** 画素ごとの輝度（0〜255）を返す関数から RGBA を作る */
function image(f: (x: number, y: number) => number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const o = (y * N + x) * 4;
      const v = f(x, y);
      d[o] = d[o + 1] = d[o + 2] = v;
      d[o + 3] = 255;
    }
  }
  return d;
}

describe('compositionFromRgba', () => {
  it('無地は、全部が余白で輪郭が無く、重心は中央', () => {
    const c = compositionFromRgba(image(() => 128), N);
    expect(c.space).toBe(1);
    expect(c.detail).toBe(0);
    expect(c.cx).toBe(0.5);
    expect(c.cy).toBe(0.5);
    expect(c.vertical).toBeCloseTo(0);
    expect(compositionTags(c)).toEqual(['airy']); // 無地は、中央・対称とは言わない
  });

  it('白地の中央に小さな黒い四角があると、余白が多く、重心は中央', () => {
    const c = compositionFromRgba(image((x, y) => (x >= 13 && x < 19 && y >= 13 && y < 19 ? 0 : 255)), N);
    expect(c.space).toBeGreaterThan(0.9);
    expect(c.cx).toBeCloseTo(0.5, 1);
    expect(c.cy).toBeCloseTo(0.5, 1);
    const tags = compositionTags(c);
    expect(tags).toContain('airy');
    expect(tags).toContain('center');
    expect(tags).toContain('symmetric');
  });

  it('左に寄った被写体は、重心が左（left）', () => {
    const c = compositionFromRgba(image((x, y) => (x >= 3 && x < 9 && y >= 13 && y < 19 ? 0 : 255)), N);
    expect(c.cx).toBeLessThan(0.3);
    const tags = compositionTags(c);
    expect(tags).toContain('left');
    expect(tags).not.toContain('right');
    expect(tags).not.toContain('center');
    expect(tags).not.toContain('symmetric');
  });

  it('右に寄った被写体は、重心が右（right）', () => {
    const c = compositionFromRgba(image((x, y) => (x >= 23 && x < 29 && y >= 13 && y < 19 ? 0 : 255)), N);
    expect(compositionTags(c)).toContain('right');
  });

  it('上が明るく下が暗い（空と地面）と、vertical が大きい（horizon）', () => {
    const c = compositionFromRgba(image((_, y) => (y < 16 ? 220 : 40)), N);
    expect(c.vertical).toBeCloseTo((220 - 40) / 255, 2);
    expect(compositionTags(c)).toContain('horizon');
    const flipped = compositionFromRgba(image((_, y) => (y < 16 ? 40 : 220)), N);
    expect(flipped.vertical).toBeLessThan(0);
    expect(compositionTags(flipped)).toContain('horizon');
  });

  it('全面に細かい模様があると、余白が少なく（busy）、細かい', () => {
    const c = compositionFromRgba(image((x, y) => ((x + y) % 2 === 0 ? 0 : 255)), N);
    expect(c.space).toBeLessThanOrEqual(0.5);
    expect(c.detail).toBeGreaterThan(0.2);
    expect(compositionTags(c)).toContain('busy');
    expect(compositionTags(c)).not.toContain('airy');
  });

  it('左右が非対称な画像は、symmetry が大きい', () => {
    const asym = compositionFromRgba(image((x) => (x < 8 ? 0 : 255)), N);
    expect(asym.symmetry).toBeGreaterThan(0.1);
    expect(compositionTags(asym)).not.toContain('symmetric');
  });
});

describe('spaceThresholds', () => {
  it('枚数が足りないときは、目安の絶対値', () => {
    expect(spaceThresholds([0.1, 0.9])).toEqual({ airy: 0.9, busy: 0.5 });
  });
  it('十分あるときは、このフォルダの上位 25% と下位 25% の境目', () => {
    const spaces = Array.from({ length: 100 }, (_, i) => i / 100);
    const t = spaceThresholds(spaces);
    expect(t.airy).toBeCloseTo(0.75);
    expect(t.busy).toBeCloseTo(0.25);
    const c = (space: number): Composition => ({ space, detail: 0.05, cx: 0.9, cy: 0.1, vertical: 0, symmetry: 0.5 });
    expect(tagsWith(c(0.8), t)).toContain('airy');
    expect(tagsWith(c(0.5), t)).not.toContain('airy');
    expect(tagsWith(c(0.5), t)).not.toContain('busy');
    expect(tagsWith(c(0.2), t)).toContain('busy');
  });
});
