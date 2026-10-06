import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { oklabToSrgb, rgbToHex } from '../core/color/oklab';
import type { GalleryItem } from './types';

export const COLOR_BAR_WIDTH = 30;

interface Props {
  cells: (GalleryItem | null)[];
  cols: number;
  favorites: ReadonlySet<string>;
  scrollerRef: RefObject<HTMLDivElement | null>;
}

interface RowColor {
  rgb: [number, number, number] | null;
  fav: boolean;
}

/** 行ごとの代表色（OKLab の平均）と、お気に入りを含むかどうか */
function rowColors(cells: (GalleryItem | null)[], cols: number, favorites: ReadonlySet<string>): RowColor[] {
  const rows = Math.ceil(cells.length / cols);
  const out: RowColor[] = [];
  for (let r = 0; r < rows; r++) {
    let L = 0;
    let a = 0;
    let b = 0;
    let n = 0;
    let fav = false;
    for (let c = 0; c < cols; c++) {
      const item = cells[r * cols + c];
      if (!item) continue;
      if (favorites.has(item.key)) fav = true;
      if (item.color) {
        L += item.color.L;
        a += item.color.a;
        b += item.color.b;
        n++;
      }
    }
    out.push({ rgb: n ? oklabToSrgb(L / n, a / n, b / n) : null, fav });
  }
  return out;
}

/** 全画像の主要色を並び順どおりに縮小して見せるカラーバー。タップ／ドラッグで該当位置へ移動する */
export function ColorBar({ cells, cols, favorites, scrollerRef }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [hint, setHint] = useState<{ y: number; hex: string } | null>(null);
  const dragging = useRef(false);

  const rows = useMemo(() => rowColors(cells, cols, favorites), [cells, cols, favorites]);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 色の帯とお気に入りの目印を描く
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(COLOR_BAR_WIDTH * dpr);
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
      ctx.fillRect(0, y, COLOR_BAR_WIDTH, 1);
    }
    rows.forEach((row, i) => {
      if (!row.fav) return;
      const y = Math.min(height - 3, Math.floor(((i + 0.5) / n) * height) - 1);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(0, y - 1, 9, 4);
      ctx.fillRect(COLOR_BAR_WIDTH - 9, y - 1, 9, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, y, 8, 2);
      ctx.fillRect(COLOR_BAR_WIDTH - 8, y, 8, 2);
    });
  }, [rows, height]);

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

  const jump = (e: React.PointerEvent) => {
    const bar = barRef.current;
    const scroller = scrollerRef.current;
    if (!bar || !scroller) return;
    const rect = bar.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    scroller.scrollTop = t * scroller.scrollHeight - scroller.clientHeight / 2;
    const rgb = rows[Math.min(rows.length - 1, Math.floor(t * rows.length))]?.rgb;
    setHint({ y: e.clientY - rect.top, hex: rgb ? rgbToHex(...rgb).toUpperCase() : '解析中' });
  };

  return (
    <div
      className="colorbar"
      ref={barRef}
      style={{ width: COLOR_BAR_WIDTH }}
      role="slider"
      aria-label="カラーバー（タップ・ドラッグで移動）"
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
      onPointerUp={() => {
        dragging.current = false;
        setHint(null);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setHint(null);
      }}
    >
      <canvas ref={canvasRef} style={{ width: COLOR_BAR_WIDTH, height }} />
      <div className="colorbar-view" ref={indicatorRef} />
      {hint && (
        <div className="colorbar-hint" style={{ top: hint.y }}>
          {hint.hex}
        </div>
      )}
    </div>
  );
}
