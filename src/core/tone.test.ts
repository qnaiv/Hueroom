import { describe, expect, it } from 'vitest';
import { toneFromRgba, toneTags, toneThresholds } from './tone';
import type { Tone } from './types';

const N = 32;

function image(f: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const o = (y * N + x) * 4;
      const [r, g, b] = f(x, y);
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
  return d;
}

describe('toneFromRgba', () => {
  it('白は明るさ 1、黒は 0。どちらも無彩色で、明暗の差は無い', () => {
    const white = toneFromRgba(image(() => [255, 255, 255]), N);
    const black = toneFromRgba(image(() => [0, 0, 0]), N);
    expect(white.brightness).toBeCloseTo(1, 2);
    expect(black.brightness).toBeCloseTo(0, 2);
    expect(white.saturation).toBeLessThan(0.001);
    expect(white.contrast).toBe(0);
    expect(black.contrast).toBe(0);
  });

  it('白黒が半々だと、明暗の差が大きい', () => {
    const t = toneFromRgba(image((x) => (x < 16 ? [0, 0, 0] : [255, 255, 255])), N);
    expect(t.contrast).toBeGreaterThan(0.95);
    expect(t.brightness).toBeCloseTo(0.5, 1);
  });

  it('鮮やかな赤は彩度が高く、同じくらいの明るさの灰色は低い', () => {
    const red = toneFromRgba(image(() => [220, 30, 30]), N);
    const grey = toneFromRgba(image(() => [110, 110, 110]), N);
    expect(red.saturation).toBeGreaterThan(0.15);
    expect(grey.saturation).toBeLessThan(0.001);
  });

  it('ごく一部の白飛びには、明暗の差が引きずられない', () => {
    // 灰色の中に 1% 未満の白い点
    const t = toneFromRgba(image((x, y) => (x === 0 && y < 5 ? [255, 255, 255] : [120, 120, 120])), N);
    expect(t.contrast).toBe(0);
  });
});

describe('toneThresholds / toneTags', () => {
  const t = (brightness: number, contrast: number, saturation: number): Tone => ({ brightness, contrast, saturation });

  it('枚数が足りないときは、目安の絶対値で判定する', () => {
    const th = toneThresholds([]);
    expect(toneTags(t(0.9, 0.7, 0.2), th)).toEqual(['bright', 'punchy', 'vivid']);
    expect(toneTags(t(0.2, 0.1, 0.01), th)).toEqual(['dark', 'soft', 'muted']);
    expect(toneTags(t(0.55, 0.4, 0.08), th)).toEqual([]);
  });

  it('十分あるときは、このフォルダの上位 25% と下位 25% の境目で判定する', () => {
    const tones = Array.from({ length: 100 }, (_, i) => t(i / 100, i / 100, i / 100));
    const th = toneThresholds(tones);
    expect(th.brightness.high).toBeCloseTo(0.75);
    expect(th.brightness.low).toBeCloseTo(0.25);
    expect(toneTags(t(0.8, 0.5, 0.9), th)).toEqual(['bright', 'vivid']);
    expect(toneTags(t(0.8, 0.5, 0.2), th)).toEqual(['bright', 'muted']);
    expect(toneTags(t(0.1, 0.1, 0.5), th)).toEqual(['dark', 'soft']);
    expect(toneTags(t(0.5, 0.5, 0.5), th)).toEqual([]);
  });

  it('全部が同じ値のフォルダでは、どのチップにも当てはまらない', () => {
    const th = toneThresholds(Array.from({ length: 20 }, () => t(0.5, 0.3, 0.1)));
    expect(toneTags(t(0.5, 0.3, 0.1), th)).toEqual([]);
  });
});
