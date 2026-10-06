import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { oklabToSrgb, rgbToHex } from '../core/color/oklab';
import type { GalleryItem } from './types';

export const NAV_BAR_WIDTH = { color: 30, date: 68 } as const;
/** 年・月のラベルが重ならないための最小の間隔（px） */
const LABEL_GAP = 12;

export type NavVariant = 'color' | 'date';

interface Props {
  variant: NavVariant;
  cells: (GalleryItem | null)[];
  cols: number;
  favorites: ReadonlySet<string>;
  scrollerRef: RefObject<HTMLDivElement | null>;
}

interface RowInfo {
  rgb: [number, number, number] | null;
  fav: boolean;
  /** その行の最初の画像の日付 */
  shotAt: number | undefined;
}

/** 行ごとの代表色（OKLab の平均）・お気に入りを含むか・日付 */
function rowInfos(cells: (GalleryItem | null)[], cols: number, favorites: ReadonlySet<string>): RowInfo[] {
  const rows = Math.ceil(cells.length / cols);
  const out: RowInfo[] = [];
  for (let r = 0; r < rows; r++) {
    let L = 0;
    let a = 0;
    let b = 0;
    let n = 0;
    let fav = false;
    let shotAt: number | undefined;
    for (let c = 0; c < cols; c++) {
      const item = cells[r * cols + c];
      if (!item) continue;
      shotAt ??= item.shotAt;
      if (favorites.has(item.key)) fav = true;
      if (item.color) {
        L += item.color.L;
        a += item.color.a;
        b += item.color.b;
        n++;
      }
    }
    out.push({ rgb: n ? oklabToSrgb(L / n, a / n, b / n) : null, fav, shotAt });
  }
  return out;
}

const monthKey = (t: number) => {
  const d = new Date(t);
  return d.getFullYear() * 12 + d.getMonth();
};
const monthText = (t: number) => `${new Date(t).getFullYear()}年${new Date(t).getMonth() + 1}月`;

interface Tick {
  y: number;
  year?: number;
  month?: number;
}

/**
 * 日付タイムラインの目盛り。月の区切りを、スクロール位置と同じ縮尺（行の位置）で並べる。
 * 写真の多い月は間隔が広く、少ない月は狭くなるので、枚数の多さが間隔で分かる。
 */
function dateTicks(rows: RowInfo[], height: number): Tick[] {
  const n = rows.length;
  if (n === 0) return [];
  const ticks: Tick[] = [];
  let prevKey: number | undefined;
  let prevYear: number | undefined;
  let lastYearY = -Infinity;
  let lastMonthY = -Infinity;
  rows.forEach((row, r) => {
    if (row.shotAt === undefined) return;
    const key = monthKey(row.shotAt);
    if (key === prevKey) return;
    prevKey = key;
    const d = new Date(row.shotAt);
    const y = (r / n) * height;
    const tick: Tick = { y };
    if (d.getFullYear() !== prevYear && y - lastYearY >= LABEL_GAP) {
      tick.year = d.getFullYear();
      lastYearY = y;
    }
    prevYear = d.getFullYear();
    if (y - lastMonthY >= LABEL_GAP) {
      tick.month = d.getMonth() + 1;
      lastMonthY = y;
    }
    ticks.push(tick);
  });
  return ticks;
}

/** 右端のナビゲーション。色モードはカラーバー、日付モードは日付タイムライン。タップ／ドラッグで移動する */
export function NavBar({ variant, cells, cols, favorites, scrollerRef }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [hint, setHint] = useState<{ y: number; text: string } | null>(null);
  const dragging = useRef(false);
  const width = NAV_BAR_WIDTH[variant];

  const rows = useMemo(() => rowInfos(cells, cols, favorites), [cells, cols, favorites]);
  const ticks = useMemo(() => (variant === 'date' ? dateTicks(rows, height) : []), [variant, rows, height]);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // カラーバーの色の帯
  useEffect(() => {
    const canvas = canvasRef.current;
    if (variant !== 'color' || !canvas || height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const n = rows.length;
    if (n === 0) return;
    const neutral = getComputedStyle(canvas).getPropertyValue('--surface-2').trim() || '#444';
    for (let y = 0; y < height; y++) {
      const rgb = rows[Math.min(n - 1, Math.floor((y / height) * n))]?.rgb;
      ctx.fillStyle = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : neutral;
      ctx.fillRect(0, y, width, 1);
    }
  }, [variant, rows, height, width]);

  // 現在の表示範囲を示す枠。スクロールのたびに React を再描画せず直接動かす
  useEffect(() => {
    const scroller = scrollerRef.current;
    const ind = indicatorRef.current;
    if (!scroller || !ind || height === 0) return;
    const update = () => {
      const total = scroller.scrollHeight;
      if (total <= 0) return;
      ind.style.top = `${(scroller.scrollTop / total) * height}px`;
      ind.style.height = `${Math.max(6, Math.min(height, (scroller.clientHeight / total) * height))}px`;
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scrollerRef, height, rows.length]);

  const jump = (e: PointerEvent) => {
    const bar = barRef.current;
    const scroller = scrollerRef.current;
    if (!bar || !scroller) return;
    const rect = bar.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    scroller.scrollTop = t * scroller.scrollHeight - scroller.clientHeight / 2;
    const row = rows[Math.min(rows.length - 1, Math.floor(t * rows.length))];
    let text: string;
    if (variant === 'date') text = row?.shotAt !== undefined ? monthText(row.shotAt) : '';
    else text = row?.rgb ? rgbToHex(...row.rgb).toUpperCase() : '解析中';
    setHint({ y: e.clientY - rect.top, text });
  };
  const endDrag = () => {
    dragging.current = false;
    setHint(null);
  };

  const favRows: number[] = [];
  rows.forEach((row, i) => row.fav && favRows.push(i));

  return (
    <div
      className={`navbar ${variant}`}
      ref={barRef}
      style={{ width }}
      role="slider"
      aria-label={variant === 'date' ? '日付タイムライン（タップ・ドラッグで移動）' : 'カラーバー（タップ・ドラッグで移動）'}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        jump(e);
      }}
      onPointerMove={(e) => dragging.current && jump(e)}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {variant === 'color' ? (
        <canvas ref={canvasRef} style={{ width, height }} />
      ) : (
        <div className="timeline">
          {ticks.map((t, i) => (
            <div key={i} className={`tick${t.year !== undefined ? ' year' : ''}`} style={{ top: t.y }}>
              <span className="tick-year">{t.year ?? ''}</span>
              <span className="tick-month">{t.month !== undefined ? `${t.month}月` : ''}</span>
            </div>
          ))}
        </div>
      )}
      {/* お気に入りの位置。どちらのモードでも同じ角のタグを右端に出す */}
      <div className="fav-marks" aria-hidden="true">
        {favRows.map((r) => (
          <svg key={r} className="fav-mark" style={{ top: Math.round(((r + 0.5) / rows.length) * height) - 5 }} viewBox="0 0 10 10">
            <path d="M0 0H10V10Z" />
          </svg>
        ))}
      </div>
      <div className="navbar-view" ref={indicatorRef} />
      {hint && hint.text && (
        <div className="navbar-hint" style={{ top: hint.y, right: width + 8 }}>
          {hint.text}
        </div>
      )}
    </div>
  );
}
