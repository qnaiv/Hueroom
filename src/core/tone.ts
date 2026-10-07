import { srgbToOklab } from './color/oklab';
import type { Tone } from './types';

/**
 * 明るさ・コントラスト・彩度の質感（canvas に依存しない純粋関数）。
 * 色抽出に使う 32×32 の画素を OKLab に変換して、全体の傾向を 3 つの数値にする。
 */
export function toneFromRgba(data: Uint8ClampedArray | Uint8Array, size: number): Tone {
  const n = size * size;
  const ls = new Float32Array(n);
  let lSum = 0;
  let cSum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const { L, a, b } = srgbToOklab(data[o]!, data[o + 1]!, data[o + 2]!);
    ls[i] = L;
    lSum += L;
    cSum += Math.hypot(a, b);
  }
  // 外れ値（ごく小さな白飛び・黒潰れ）に引きずられないよう、5〜95 パーセンタイルの幅を見る
  ls.sort();
  const lo = ls[Math.floor(n * 0.05)]!;
  const hi = ls[Math.min(n - 1, Math.floor(n * 0.95))]!;
  return { brightness: lSum / n, contrast: hi - lo, saturation: cSum / n };
}

/** 質感の傾向（表示時に指標から決める。しきい値を変えても再解析は要らない） */
export type ToneTag = 'bright' | 'dark' | 'punchy' | 'soft' | 'vivid' | 'muted';

export const TONE_TAGS: readonly ToneTag[] = ['bright', 'dark', 'punchy', 'soft', 'vivid', 'muted'];

export const TONE_LABEL: Record<ToneTag, string> = {
  bright: '明るい',
  dark: '暗い',
  punchy: 'メリハリ',
  soft: 'ふんわり',
  vivid: 'ビビッド',
  muted: 'くすみ',
};

export const TONE_HINT: Record<ToneTag, string> = {
  bright: '全体の明るさが、このフォルダの中で明るいほう（上位 25%）',
  dark: '全体の明るさが、このフォルダの中で暗いほう（下位 25%）',
  punchy: '明暗の差が、このフォルダの中で大きいほう（上位 25%）。くっきりしている',
  soft: '明暗の差が、このフォルダの中で小さいほう（下位 25%）。ふんわり、平らな印象',
  vivid: '色の鮮やかさが、このフォルダの中で高いほう（上位 25%）',
  muted: '色の鮮やかさが、このフォルダの中で低いほう（下位 25%）。くすんだ、落ち着いた色',
};

interface Range {
  /** この値以上なら「高いほう」 */
  high: number;
  /** この値以下なら「低いほう」 */
  low: number;
}

export type ToneThresholds = Record<keyof Tone, Range>;

/** 比べるだけの枚数が無いときの目安（絶対値） */
const FALLBACK: ToneThresholds = {
  brightness: { high: 0.75, low: 0.4 },
  contrast: { high: 0.6, low: 0.25 },
  saturation: { high: 0.12, low: 0.04 },
};
const MIN_SAMPLES = 12;

/**
 * 質感の指標は、写真の集まりごとにばらつき方が違う（風景ばかり、モノクロばかり、など）ので、
 * 絶対値ではなく「このフォルダの中で高いほう・低いほう」（上位・下位 25%）で決める。
 */
export function toneThresholds(tones: readonly Tone[]): ToneThresholds {
  if (tones.length < MIN_SAMPLES) return FALLBACK;
  const range = (pick: (t: Tone) => number): Range => {
    const sorted = tones.map(pick).sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
    return { high: q(0.75), low: q(0.25) };
  };
  return {
    brightness: range((t) => t.brightness),
    contrast: range((t) => t.contrast),
    saturation: range((t) => t.saturation),
  };
}

export function toneTags(t: Tone, th: ToneThresholds): ToneTag[] {
  const tags: ToneTag[] = [];
  // 全部が同じ値のときに、高い・低いの両方に当たらないよう、幅があるときだけ判定する
  const pair = (v: number, r: Range, high: ToneTag, low: ToneTag) => {
    if (r.high <= r.low) return;
    if (v >= r.high) tags.push(high);
    else if (v <= r.low) tags.push(low);
  };
  pair(t.brightness, th.brightness, 'bright', 'dark');
  pair(t.contrast, th.contrast, 'punchy', 'soft');
  pair(t.saturation, th.saturation, 'vivid', 'muted');
  return tags;
}
