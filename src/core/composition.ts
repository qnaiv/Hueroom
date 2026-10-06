import type { Composition } from './types';

/**
 * 構図の指標（canvas に依存しない純粋関数）。
 * 色抽出に使う 32×32 の画素をそのまま使い、輝度の勾配（エッジ）と明暗の分布だけを見る。
 * 被写体の認識はしない。「余白が多い」「中央に寄っている」といった大づかみの傾向を数値にする。
 */

/** この勾配より小さい画素は「のっぺり（余白）」とみなす */
const FLAT_EDGE = 0.03;

const luma = (r: number, g: number, b: number): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** size×size の RGBA から構図の指標を求める。size は 4 以上 */
export function compositionFromRgba(data: Uint8ClampedArray | Uint8Array, size: number): Composition {
  const n = size * size;
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    y[i] = luma(data[o]!, data[o + 1]!, data[o + 2]!);
  }
  const at = (px: number, py: number): number =>
    y[Math.min(size - 1, Math.max(0, py)) * size + Math.min(size - 1, Math.max(0, px))]!;

  let edgeSum = 0;
  let flat = 0;
  let sx = 0;
  let sy = 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // 隣の画素との差（中心差分だと、1 画素ごとの細かい模様を拾えない）
      const gx = at(px + 1, py) - at(px, py);
      const gy = at(px, py + 1) - at(px, py);
      const g = Math.hypot(gx, gy);
      edgeSum += g;
      if (g < FLAT_EDGE) flat++;
      sx += g * (px + 0.5);
      sy += g * (py + 0.5);
    }
  }

  const half = size / 2;
  let top = 0;
  let bottom = 0;
  let mirror = 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const v = y[py * size + px]!;
      if (py < half) top += v;
      else bottom += v;
      if (px < half) mirror += Math.abs(v - y[py * size + (size - 1 - px)]!);
    }
  }
  const halfCount = n / 2;
  const hasEdges = edgeSum > 1e-6;
  return {
    space: flat / n,
    detail: edgeSum / n,
    cx: hasEdges ? sx / edgeSum / size : 0.5,
    cy: hasEdges ? sy / edgeSum / size : 0.5,
    vertical: top / halfCount - bottom / halfCount,
    symmetry: mirror / halfCount,
  };
}

/** 構図の傾向（表示時に指標から決める。しきい値を変えても再解析は要らない） */
export type CompositionTag = 'airy' | 'busy' | 'center' | 'left' | 'right' | 'horizon' | 'symmetric';

export const COMPOSITION_TAGS: readonly CompositionTag[] = ['airy', 'busy', 'center', 'left', 'right', 'horizon', 'symmetric'];

export const COMPOSITION_LABEL: Record<CompositionTag, string> = {
  airy: '余白が多い',
  busy: 'ぎっしり',
  center: '中央',
  left: '左寄り',
  right: '右寄り',
  horizon: '上下で明暗',
  symmetric: '左右対称',
};

export const COMPOSITION_HINT: Record<CompositionTag, string> = {
  airy: 'のっぺりした面（空・壁・余白）が、このフォルダの中で多いほう（上位 25%）',
  busy: 'のっぺりした面が、このフォルダの中で少ないほう（下位 25%）。細かい',
  center: '輪郭の重心が中央付近',
  left: '輪郭の重心が左（三分割の左）',
  right: '輪郭の重心が右（三分割の右）',
  horizon: '上半分と下半分の明るさが大きく違う（空と地面など）',
  symmetric: '左右を折り返すとよく重なる',
};

/**
 * 余白の量は、32×32 では大半の写真が「のっぺり」側に寄るので、絶対値ではなく
 * 「このフォルダの中で多いほう・少ないほう」で決める（上位・下位 25%）。
 */
export interface SpaceThresholds {
  /** この値以上なら「余白が多い」 */
  airy: number;
  /** この値以下なら「ぎっしり」 */
  busy: number;
}

/** 比べるだけの枚数が無いときの目安（絶対値） */
const FALLBACK_SPACE: SpaceThresholds = { airy: 0.9, busy: 0.5 };
const MIN_SAMPLES = 12;

export function spaceThresholds(spaces: readonly number[]): SpaceThresholds {
  if (spaces.length < MIN_SAMPLES) return FALLBACK_SPACE;
  const sorted = [...spaces].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  return { airy: q(0.75), busy: q(0.25) };
}

const CENTER_RADIUS = 0.15;
const SIDE_MARGIN = 0.12;
const HORIZON_GAP = 0.2;
const SYMMETRIC_DIFF = 0.04;
/** 輪郭がほぼ無い画像（無地など）は、重心を判定しない */
const MIN_DETAIL = 0.003;
/** 無地に近い画像は、左右対称とは言わない */
const MIN_SYMMETRIC_DETAIL = 0.02;

export function compositionTags(c: Composition, space: SpaceThresholds): CompositionTag[] {
  const tags: CompositionTag[] = [];
  if (c.space >= space.airy) tags.push('airy');
  if (c.space <= space.busy) tags.push('busy');
  if (c.detail >= MIN_DETAIL) {
    if (Math.hypot(c.cx - 0.5, c.cy - 0.5) <= CENTER_RADIUS) tags.push('center');
    if (c.cx <= 0.5 - SIDE_MARGIN) tags.push('left');
    if (c.cx >= 0.5 + SIDE_MARGIN) tags.push('right');
  }
  if (c.detail >= MIN_SYMMETRIC_DETAIL && c.symmetry <= SYMMETRIC_DIFF) tags.push('symmetric');
  if (Math.abs(c.vertical) >= HORIZON_GAP) tags.push('horizon');
  return tags;
}
