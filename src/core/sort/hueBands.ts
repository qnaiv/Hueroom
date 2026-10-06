import { oklabDistance } from '../color/oklab';
import type { SortableItem } from '../types';

/**
 * 色順の並び替え。
 *
 * - 彩度が低い画像（白・黒・グレー）は別グループにして、明度の高い順で末尾に置く
 * - 有彩色は色相で N 帯に分け、帯ごとに明暗の向きを交互に折り返す
 * - 帯の中は OKLab 距離の最近傍法で隣同士の色差を小さくする
 *   （起点は、その帯で明暗の向きの側にある画像のうち、直前の帯の終端に最も近いもの）
 * - 色がまだ無い（解析前の）画像は、さらにその後ろへ置く
 */

export interface HueBandOptions {
  /** 色相帯の数 */
  bands?: number;
  /** これ未満の彩度は無彩色グループにする */
  grayChroma?: number;
  /** 帯の画像数がこれを超えたら最近傍法をやめて明度順にする（O(n²) 対策） */
  maxNearest?: number;
}

type Colored = SortableItem & { color: NonNullable<SortableItem['color']> };

const hasColor = (x: SortableItem): x is Colored => x.color !== undefined;

/** 帯を決める。赤が帯の中央に来るよう半帯ずらす */
export function hueBandIndex(hue: number, bands: number): number {
  const width = 360 / bands;
  return Math.floor((((hue + width / 2) % 360) + 360) % 360 / width) % bands;
}

/** 最近傍法で並べる。start は rest の中の起点 */
function nearestChain<T extends Colored>(start: T, rest: T[]): T[] {
  const left = rest.filter((x) => x !== start);
  const out: T[] = [start];
  let cur = start;
  while (left.length > 0) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = oklabDistance(cur.color, (left[i] as T).color);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    cur = left.splice(bi, 1)[0] as T;
    out.push(cur);
  }
  return out;
}

export function sortByColor<T extends SortableItem>(items: readonly T[], opts: HueBandOptions = {}): T[] {
  const { bands: bandCount = 12, grayChroma = 0.04, maxNearest = 1500 } = opts;
  const colored = items.filter(hasColor) as (T & Colored)[];
  const pending = items.filter((x) => !hasColor(x));

  const chromatic = colored.filter((x) => x.color.C >= grayChroma);
  const grays = colored.filter((x) => x.color.C < grayChroma);

  const bands: (T & Colored)[][] = Array.from({ length: bandCount }, () => []);
  for (const x of chromatic) (bands[hueBandIndex(x.color.H, bandCount)] as (T & Colored)[]).push(x);

  const out: T[] = [];
  let prevEnd: Colored | undefined;
  let dir = 0; // 0: 暗→明, 1: 明→暗
  for (const band of bands) {
    if (band.length === 0) continue;
    const byL = [...band].sort((p, q) => p.color.L - q.color.L || p.key.localeCompare(q.key));
    const ordered = dir === 0 ? byL : [...byL].reverse();
    let seq: (T & Colored)[];
    if (band.length > maxNearest) {
      seq = ordered;
    } else {
      // 起点候補: 向きの側（先頭 1/4）。直前の帯の終端に最も近いものを選ぶ
      const head = ordered.slice(0, Math.max(1, Math.ceil(ordered.length / 4)));
      let start = head[0] as T & Colored;
      if (prevEnd) {
        let bd = Infinity;
        for (const c of head) {
          const d = oklabDistance(prevEnd.color, c.color);
          if (d < bd) {
            bd = d;
            start = c;
          }
        }
      }
      seq = nearestChain(start, ordered);
    }
    out.push(...seq);
    prevEnd = seq[seq.length - 1];
    dir = 1 - dir;
  }

  grays.sort((p, q) => q.color.L - p.color.L || p.key.localeCompare(q.key));
  out.push(...grays, ...pending);
  return out;
}

/** 隣同士の OKLab 距離の合計（並びの滑らかさの指標。テスト用にも使う） */
export function totalStepDistance(items: readonly SortableItem[]): number {
  let sum = 0;
  for (let i = 1; i < items.length; i++) {
    const p = (items[i - 1] as SortableItem).color;
    const q = (items[i] as SortableItem).color;
    if (p && q) sum += oklabDistance(p, q);
  }
  return sum;
}
