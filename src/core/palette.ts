import type { PaletteColor } from './types';

/**
 * 2 つの配色の近さ（小さいほど似ている）。
 * 片方の各色について、もう片方の一番近い色との OKLab 距離を、占有率で重み付けして足し、両方向の平均を取る。
 * 色の数が違っても比べられる。色の位置（どこに何色があるか）は見ない。
 */
export function paletteDistance(p: readonly PaletteColor[], q: readonly PaletteColor[]): number {
  if (p.length === 0 || q.length === 0) return Infinity;
  const oneWay = (from: readonly PaletteColor[], to: readonly PaletteColor[]): number => {
    let sum = 0;
    for (const c of from) {
      let best = Infinity;
      for (const d of to) {
        const dist = Math.hypot(c.L - d.L, c.a - d.a, c.b - d.b);
        if (dist < best) best = dist;
      }
      sum += c.share * best;
    }
    return sum;
  };
  return (oneWay(p, q) + oneWay(q, p)) / 2;
}

interface HasPalette {
  key: string;
  analysis?: { palette: PaletteColor[] };
}

/**
 * 基準の画像の配色に近い順に並べる（基準の画像が先頭）。入力は変更しない。
 * 解析が終わっていない画像は最後に置く。同じ近さはキーで安定させる。
 */
export function sortByPalette<T extends HasPalette>(items: readonly T[], ref: PaletteColor[]): T[] {
  const scored = items.map((item) => ({
    item,
    d: item.analysis ? paletteDistance(ref, item.analysis.palette) : Infinity,
  }));
  scored.sort((a, b) => (a.d === b.d ? a.item.key.localeCompare(b.item.key) : a.d - b.d));
  return scored.map((s) => s.item);
}
