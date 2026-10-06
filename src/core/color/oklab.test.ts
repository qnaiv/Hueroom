import { describe, expect, it } from 'vitest';
import { oklabDistance, oklabToOklch, oklabToSrgb, oklchToOklab, rgbToHex, srgbToOklab } from './oklab';

describe('OKLab 変換', () => {
  it('白は L=1・無彩色、黒は L=0', () => {
    const w = srgbToOklab(255, 255, 255);
    expect(w.L).toBeCloseTo(1, 3);
    expect(Math.hypot(w.a, w.b)).toBeLessThan(1e-3);
    expect(srgbToOklab(0, 0, 0).L).toBeCloseTo(0, 5);
  });

  it('既知の値（純赤）に一致する', () => {
    const r = srgbToOklab(255, 0, 0);
    expect(r.L).toBeCloseTo(0.628, 3);
    expect(r.a).toBeCloseTo(0.2249, 3);
    expect(r.b).toBeCloseTo(0.1258, 3);
  });

  it('sRGB → OKLab → sRGB で元に戻る', () => {
    for (const [r, g, b] of [[12, 200, 90], [250, 30, 180], [128, 128, 128], [1, 2, 3], [255, 255, 0]] as const) {
      const lab = srgbToOklab(r, g, b);
      expect(oklabToSrgb(lab.L, lab.a, lab.b)).toEqual([r, g, b]);
    }
  });

  it('OKLCH との往復と色相の範囲', () => {
    const { L, C, H } = oklabToOklch(0.6, -0.1, -0.05);
    expect(H).toBeGreaterThanOrEqual(0);
    expect(H).toBeLessThan(360);
    const back = oklchToOklab(L, C, H);
    expect(back.a).toBeCloseTo(-0.1, 6);
    expect(back.b).toBeCloseTo(-0.05, 6);
  });

  it('距離は対称で、同色は 0', () => {
    const p = srgbToOklab(10, 20, 30);
    const q = srgbToOklab(200, 100, 50);
    expect(oklabDistance(p, p)).toBe(0);
    expect(oklabDistance(p, q)).toBeCloseTo(oklabDistance(q, p), 12);
    expect(oklabDistance(p, q)).toBeGreaterThan(0);
  });

  it('hex 変換', () => {
    expect(rgbToHex(255, 0, 10)).toBe('#ff000a');
  });
});
