import { useEffect, useRef, useState } from 'react';
import type { GalleryItem } from './types';

interface Props {
  item: GalleryItem;
  index: number;
  count: number;
  isFavorite: boolean;
  onToggleFavorite(): void;
  onMove(delta: number): void;
  onClose(): void;
}

const HEART = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21s-7.5-4.6-9.6-9.3C1 8.5 2.9 5 6.2 5c2 0 3.5 1.1 4.3 2.4h3C14.3 6.1 15.8 5 17.8 5c3.3 0 5.2 3.5 3.8 6.7C19.5 16.4 12 21 12 21z" />
  </svg>
);

const formatBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** 拡大表示。ここでお気に入りの登録・解除ができる */
export function Lightbox({ item, index, count, isFavorite, onToggleFavorite, onMove, onClose }: Props) {
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
            <span>{new Date(item.lastModified).toLocaleDateString('ja-JP')}</span>
          </div>
          <div className="lb-actions">
            <button
              type="button"
              className="btn fav-btn"
              aria-pressed={isFavorite}
              onClick={onToggleFavorite}
              title="お気に入り（F キー）"
            >
              {HEART}
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

export { HEART };
