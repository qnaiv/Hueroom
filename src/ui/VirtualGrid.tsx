import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useElementSize } from './useElementSize';
import type { GalleryItem } from './types';

export const GRID_GAP = 4;
export const GRID_PAD = 8;
const OVERSCAN_ROWS = 3;

/** 画面幅と目標タイルサイズから列数を決める */
export function columnsFor(width: number, target: number): number {
  return Math.max(2, Math.floor((width - GRID_PAD * 2 + GRID_GAP) / (target + GRID_GAP)));
}

/** サムネイルの Blob を object URL にする。表示範囲を外れてタイルが消えたら解放する */
function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

interface TileProps {
  item: GalleryItem;
  size: number;
  x: number;
  y: number;
  favorite: boolean;
  onOpen(item: GalleryItem): void;
}

const Tile = memo(
  function Tile({ item, size, x, y, favorite, onOpen }: TileProps) {
    const url = useObjectUrl(item.analysis?.thumb);
    return (
      <button
        type="button"
        className={`tile${item.failed ? ' failed' : ''}`}
        style={{
          width: size,
          height: size,
          transform: `translate3d(${x}px,${y}px,0)`,
          // 画像を読み込む前は、その画像の主要色で塗ったプレースホルダを見せる
          background: item.analysis?.color.hex,
        }}
        onClick={() => onOpen(item)}
        aria-label={`${item.name}${favorite ? '（お気に入り）' : ''} を拡大`}
        title={item.failed ? `${item.name}（読み込めませんでした）` : item.name}
      >
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            decoding="async"
            onLoad={(e) => e.currentTarget.classList.add('loaded')}
          />
        )}
        <span className="tile-name">{item.name}</span>
        {/* お気に入り済みの画像は、右上の角を金色の三角で塗る（表示のみ。登録・解除は拡大表示で行う） */}
        {favorite && (
          <svg className="fav-tag" viewBox="0 0 28 28" aria-hidden="true">
            <path d="M0 0H28V28Z" />
          </svg>
        )}
      </button>
    );
  },
  (a, b) =>
    a.item.key === b.item.key &&
    a.item.analysis === b.item.analysis &&
    a.item.failed === b.item.failed &&
    a.favorite === b.favorite &&
    a.size === b.size &&
    a.x === b.x &&
    a.y === b.y,
);

interface Props {
  /** 表示セル順（行優先）。端数の空きは null */
  cells: (GalleryItem | null)[];
  cols: number;
  tileTarget: number;
  onColsChange(cols: number): void;
  favorites: ReadonlySet<string>;
  onOpen(item: GalleryItem): void;
  scrollerRef: RefObject<HTMLDivElement | null>;
}

/** 表示範囲の行だけを描画する仮想スクロールのグリッド */
export function VirtualGrid({ cells, cols, tileTarget, onColsChange, favorites, onOpen, scrollerRef }: Props) {
  const { width, height } = useElementSize(scrollerRef);
  const [scrollTop, setScrollTop] = useState(0);
  const raf = useRef(0);

  // 幅から列数を決めて親に伝える（親が蛇行配置のセルを作る）
  useLayoutEffect(() => {
    if (width > 0) onColsChange(columnsFor(width, tileTarget));
  }, [width, tileTarget, onColsChange]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        setScrollTop(el.scrollTop);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [scrollerRef]);

  const rows = Math.ceil(cells.length / cols);
  const size = Math.max(1, (width - GRID_PAD * 2 - GRID_GAP * (cols - 1)) / cols);
  const rowH = size + GRID_GAP;
  const total = rows > 0 ? rows * rowH - GRID_GAP + GRID_PAD * 2 : 0;
  const first = Math.max(0, Math.floor((scrollTop - GRID_PAD) / rowH) - OVERSCAN_ROWS);
  const last = Math.min(rows - 1, Math.ceil((scrollTop + height - GRID_PAD) / rowH) + OVERSCAN_ROWS);

  const tiles = [];
  for (let r = first; r <= last; r++) {
    for (let c = 0; c < cols; c++) {
      const item = cells[r * cols + c];
      if (!item) continue;
      tiles.push(
        <Tile key={item.key} item={item} size={size} x={GRID_PAD + c * rowH} y={GRID_PAD + r * rowH} favorite={favorites.has(item.key)} onOpen={onOpen} />,
      );
    }
  }
  return (
    <div className="grid-inner" style={{ height: total }}>
      {tiles}
    </div>
  );
}
