import type { DominantColor } from '../types';
import { oklabToOklch, oklabToSrgb, rgbToHex, srgbToOklab, type Lab } from './oklab';

/**
 * 主要色の抽出（canvas に依存しない純粋関数）。
 *
 * 1. 画素を OKLab に変換（透明に近い画素は除外、白飛び・黒潰れは重みを下げる）
 * 2. k-means++（固定シードで決定的）でクラスタリング
 * 3. スコア = 占有率 × (SCORE_BASE + 彩度C) が最大のクラスタ中心を主要色にする
 *    → 面積が小さくても鮮やかな色が「印象色」として選ばれやすく、
 *      全体が低彩度なら最大面積の色になる
 */

export interface QuantizeOptions {
  k?: number;
  iterations?: number;
  seed?: number;
}

/** 彩度をどれだけ優遇するか。小さいほど鮮やかな色を優先する */
const SCORE_BASE = 0.04;
/** 白飛び・黒潰れ画素の重み */
const EXTREME_WEIGHT = 0.3;
const ALPHA_THRESHOLD = 128;

interface Sample extends Lab {
  w: number;
}

/** 決定的な乱数（LCG） */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const dist2 = (p: Lab, q: Lab): number => (p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;

/** RGBA 画素列から OKLab のサンプルを作る */
export function samplesFromRgba(data: ArrayLike<number>): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    if ((data[i + 3] as number) < ALPHA_THRESHOLD) continue;
    const lab = srgbToOklab(data[i] as number, data[i + 1] as number, data[i + 2] as number);
    const extreme = lab.L < 0.1 || lab.L > 0.95;
    out.push({ ...lab, w: extreme ? EXTREME_WEIGHT : 1 });
  }
  return out;
}

/** k-means++ の初期中心選び */
function initCenters(samples: Sample[], k: number, rng: () => number): Lab[] {
  const first = samples[Math.floor(rng() * samples.length)] as Sample;
  const centers: Lab[] = [{ L: first.L, a: first.a, b: first.b }];
  const d = new Float64Array(samples.length).fill(Infinity);
  while (centers.length < k) {
    const last = centers[centers.length - 1] as Lab;
    let total = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i] as Sample;
      d[i] = Math.min(d[i] as number, dist2(s, last));
      total += (d[i] as number) * s.w;
    }
    if (total === 0) break; // 全画素が同色
    let r = rng() * total;
    let pick = samples.length - 1;
    for (let i = 0; i < samples.length; i++) {
      r -= (d[i] as number) * (samples[i] as Sample).w;
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    const p = samples[pick] as Sample;
    centers.push({ L: p.L, a: p.a, b: p.b });
  }
  return centers;
}

interface Cluster extends Lab {
  share: number;
}

export function clusterSamples(samples: Sample[], opts: QuantizeOptions = {}): Cluster[] {
  const { k = 5, iterations = 12, seed = 1 } = opts;
  if (samples.length === 0) return [];
  const rng = createRng(seed);
  let centers = initCenters(samples, Math.min(k, samples.length), rng);
  const assign = new Int32Array(samples.length);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    const sum = centers.map(() => ({ L: 0, a: 0, b: 0, w: 0 }));
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i] as Sample;
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dd = dist2(s, centers[c] as Lab);
        if (dd < bd) {
          bd = dd;
          best = c;
        }
      }
      if (assign[i] !== best) moved = true;
      assign[i] = best;
      const acc = sum[best] as { L: number; a: number; b: number; w: number };
      acc.L += s.L * s.w;
      acc.a += s.a * s.w;
      acc.b += s.b * s.w;
      acc.w += s.w;
    }
    centers = centers.map((c, i) => {
      const acc = sum[i] as { L: number; a: number; b: number; w: number };
      return acc.w > 0 ? { L: acc.L / acc.w, a: acc.a / acc.w, b: acc.b / acc.w } : c;
    });
    if (!moved && it > 0) break;
  }
  // 占有率（重み付き）
  const weight = new Float64Array(centers.length);
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    const w = (samples[i] as Sample).w;
    weight[assign[i] as number] = (weight[assign[i] as number] as number) + w;
    total += w;
  }
  return centers.map((c, i) => ({ ...c, share: (weight[i] as number) / total }));
}

/** 画素列（RGBA）から主要色を求める。有効な画素が無ければ null */
export function dominantFromRgba(data: ArrayLike<number>, opts?: QuantizeOptions): DominantColor | null {
  const clusters = clusterSamples(samplesFromRgba(data), opts);
  if (clusters.length === 0) return null;
  let best = clusters[0] as Cluster;
  let bestScore = -1;
  for (const c of clusters) {
    if (c.share === 0) continue;
    const score = c.share * (SCORE_BASE + Math.hypot(c.a, c.b));
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  const { C, H } = oklabToOklch(best.L, best.a, best.b);
  const [r, g, b] = oklabToSrgb(best.L, best.a, best.b);
  return { L: best.L, a: best.a, b: best.b, C, H, hex: rgbToHex(r, g, b) };
}
