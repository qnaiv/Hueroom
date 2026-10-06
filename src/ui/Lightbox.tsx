import { useEffect, useRef, useState } from 'react';
import { STAR } from './icons';
import type { GalleryItem } from './types';

interface Props {
  item: GalleryItem;
  index: number;
  count: number;
  isFavorite: boolean;
  /** 解析が終わっていない画像は、まだお気に入りにできない */
  canFavorite: boolean;
  onToggleFavorite(): void;
  onMove(delta: number): void;
  onClose(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const formatDateTime = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const formatBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** 拡大表示。ここでお気に入りの登録・解除ができる */
export function Lightbox({ item, index, count, isFavorite, canFavorite, onToggleFavorite, onMove, onClose }: Props) {
  const [src, setSrc] = useState<string>();
  const [size, setSize] = useState<{ w: number; h: number }>();
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 元画像を読み込む。読み込み中はサムネイルを引き伸ばして見せる
  useEffect(() => {
    let url: string | undefined;
    let alive = true;
    setSrc(undefined);
    setSize(undefined);
    setLoaded(false);
    item.ref.getFile().then((blob) => {
      if (!alive) return;
      url = URL.createObjectURL(blob);
      setSrc(url);
    }, () => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.ref]);

  const thumb = useThumb(item);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onMove(-1);
      else if (e.key === 'ArrowRight') onMove(1);
      else if (e.key === 'f' || e.key === 'F') onToggleFavorite();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onMove, onToggleFavorite]);

  const hex = item.analysis?.color.hex;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.name} onClick={onClose}>
      <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="lb-nav prev" aria-label="前の画像" onClick={() => onMove(-1)} disabled={index <= 0}>
          ‹
        </button>
        <div className="lb-image">
          {thumb && !loaded && <img className="lb-thumb" src={thumb} alt="" />}
          {src && (
            <img
              className="lb-full"
              src={src}
              alt={item.name}
              onLoad={(e) => {
                setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                setLoaded(true);
              }}
            />
          )}
        </div>
        <button type="button" className="lb-nav next" aria-label="次の画像" onClick={() => onMove(1)} disabled={index >= count - 1}>
          ›
        </button>
        <div className="lb-meta">
          <div className="lb-title">
            <strong>{item.name}</strong>
            <span className="lb-count">
              {index + 1} / {count}
            </span>
          </div>
          <div className="lb-info">
            {hex && (
              <span className="lb-color">
                <i style={{ background: hex }} />
                主要色 {hex.toUpperCase()}
              </span>
            )}
            <span>{item.ref.path}</span>
            {size && <span>{size.w}×{size.h}px</span>}
            <span>{formatBytes(item.ref.size)}</span>
            <span>
              {item.shotFromExif ? '撮影' : '更新'} {formatDateTime(item.shotAt)}
            </span>
          </div>
          <div className="lb-actions">
            <button
              type="button"
              className="btn fav-btn"
              aria-pressed={isFavorite}
              onClick={onToggleFavorite}
              disabled={!canFavorite}
              title={canFavorite ? 'お気に入り（F キー）' : '解析が終わると、お気に入りにできます'}
            >
              {STAR}
              {isFavorite ? 'お気に入り済み' : 'お気に入りに追加'}
            </button>
            <button type="button" className="btn" ref={closeRef} onClick={onClose}>
              閉じる（Esc）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** サムネイルの object URL（Lightbox が開いている間だけ） */
function useThumb(item: GalleryItem): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const blob = item.analysis?.thumb;
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item.analysis]);
  return url;
}

