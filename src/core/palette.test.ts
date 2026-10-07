import { describe, expect, it } from 'vitest';
import { paletteDistance, sortByPalette } from './palette';
import { oklabToSrgb, rgbToHex, srgbToOklab } from './color/oklab';
import type { PaletteColor } from './types';

const color = (r: number, g: number, b: number, share: number): PaletteColor => {
  const lab = srgbToOklab(r, g, b);
  const [rr, gg, bb] = oklabToSrgb(lab.L, lab.a, lab.b);
  return { ...lab, hex: rgbToHex(rr, gg, bb), share };
};

const sunset = [color(30, 60, 160, 0.5), color(240, 140, 40, 0.3), color(240, 220, 190, 0.2)];
const sunsetB = [color(35, 65, 150, 0.45), color(235, 150, 50, 0.35), color(230, 215, 190, 0.2)];
const forest = [color(30, 100, 40, 0.6), color(70, 140, 60, 0.3), color(30, 40, 30, 0.1)];

describe('paletteDistance', () => {
  it('同じ配色は 0、対称', () => {
    expect(paletteDistance(sunset, sunset)).toBe(0);
    expect(paletteDistance(sunset, forest)).toBeCloseTo(paletteDistance(forest, sunset), 10);
  });

  it('似た配色のほうが、違う配色より近い', () => {
    expect(paletteDistance(sunset, sunsetB)).toBeLessThan(paletteDistance(sunset, forest));
  });

  it('色の数が違っても比べられる。空なら無限大', () => {
    const one = [color(30, 60, 160, 1)];
    expect(paletteDistance(one, sunset)).toBeGreaterThan(0);
    expect(Number.isFinite(paletteDistance(one, sunset))).toBe(true);
    expect(paletteDistance([], sunset)).toBe(Infinity);
  });

  it('代表色 1 色が同じでも、配色が違えば離れる', () => {
    // どちらも一番大きい色は同じ青。残りが違う
    const a = [color(30, 60, 160, 0.6), color(240, 140, 40, 0.4)];
    const b = [color(30, 60, 160, 0.6), color(30, 150, 170, 0.4)];
    const c = [color(30, 60, 160, 0.6), color(240, 150, 50, 0.4)];
    expect(paletteDistance(a, c)).toBeLessThan(paletteDistance(a, b));
  });
});

describe('sortByPalette', () => {
  const item = (key: string, palette?: PaletteColor[]) => ({ key, analysis: palette ? { palette } : undefined });

  it('基準の配色に近い順（基準が先頭）。未解析は最後', () => {
    const items = [item('forest', forest), item('pending'), item('sunsetB', sunsetB), item('sunset', sunset)];
    expect(sortByPalette(items, sunset).map((x) => x.key)).toEqual(['sunset', 'sunsetB', 'forest', 'pending']);
  });

  it('同じ近さはキーで安定させ、入力は変更しない', () => {
    const items = [item('b', forest), item('a', forest)];
    const before = [...items];
    expect(sortByPalette(items, forest).map((x) => x.key)).toEqual(['a', 'b']);
    expect(items).toEqual(before);
  });
});
