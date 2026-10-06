import { describe, expect, it } from 'vitest';
import { dominantFromRgba } from './quantize';

/** [r,g,b,割合] の列から RGBA 画素列（総数 n）を作る */
function pixels(parts: [number, number, number, number][], n = 1024, alpha = 255): Uint8ClampedArray {
  const data = new Uint8ClampedArray(n * 4);
  let i = 0;
  for (const [r, g, b, share] of parts) {
    const count = Math.round(n * share);
    for (let k = 0; k < count && i < n; k++, i++) data.set([r, g, b, alpha], i * 4);
  }
  return data;
}

describe('dominantFromRgba', () => {
  it('単色画像はその色を返す', () => {
    const c = dominantFromRgba(pixels([[200, 40, 40, 1]]));
    expect(c).not.toBeNull();
    expect(c!.hex).toBe('#c82828');
  });

  it('平均色ではなく主要色を返す（赤 50% + 青 50% で紫にならない）', () => {
    const c = dominantFromRgba(pixels([[220, 20, 20, 0.55], [20, 20, 220, 0.45]]))!;
    // 平均は紫（約 #7a147a）。主要色は赤か青のどちらかで、紫ではない
    const isRed = c.H < 60 || c.H > 330;
    const isBlue = c.H > 230 && c.H < 290;
    expect(isRed || isBlue).toBe(true);
    expect(c.C).toBeGreaterThan(0.15);
  });

  it('面積が小さくても鮮やかな色（20%）を、背景の灰色（80%）より優先する', () => {
    const c = dominantFromRgba(pixels([[128, 128, 128, 0.8], [230, 30, 40, 0.2]]))!;
    expect(c.C).toBeGreaterThan(0.15);
    expect(c.hex[1]).toBe('e'); // 赤
  });

  it('鮮やかな色がごくわずか（5%）なら、大きな灰色の面積を選ぶ', () => {
    const c = dominantFromRgba(pixels([[128, 128, 128, 0.95], [230, 30, 40, 0.05]]))!;
    expect(c.C).toBeLessThan(0.04);
  });

  it('グレースケール画像は低彩度', () => {
    const c = dominantFromRgba(pixels([[40, 40, 40, 0.5], [180, 180, 180, 0.5]]))!;
    expect(c.C).toBeLessThan(0.01);
  });

  it('半透明の画素は無視する', () => {
    const data = pixels([[255, 0, 0, 1]], 256, 10);
    expect(dominantFromRgba(data)).toBeNull();
    // 不透明な緑が少しでもあればそれを返す
    const mixed = pixels([[255, 0, 0, 0.9]], 256, 10);
    for (let i = 230; i < 256; i++) mixed.set([0, 200, 0, 255], i * 4);
    expect(dominantFromRgba(mixed)!.H).toBeGreaterThan(110);
    expect(dominantFromRgba(mixed)!.H).toBeLessThan(180);
  });

  it('同じ入力には常に同じ結果を返す（決定的）', () => {
    const d = pixels([[10, 200, 90, 0.3], [250, 220, 30, 0.3], [30, 30, 90, 0.4]]);
    expect(dominantFromRgba(d)).toEqual(dominantFromRgba(d));
  });

  it('空の入力は null', () => {
    expect(dominantFromRgba(new Uint8ClampedArray(0))).toBeNull();
  });
});
