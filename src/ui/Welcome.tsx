import type { RestoreResult } from '../platform/types';

interface Props {
  onPick(): void;
  onReopen(): void;
  restore: RestoreResult;
  persistent: boolean;
  error: string | null;
}

/** フォルダ未選択のときの画面 */
export function Welcome({ onPick, onReopen, restore, persistent, error }: Props) {
  return (
    <main className="welcome">
      <div className="welcome-card">
        <div className="welcome-swatch" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} style={{ background: `oklch(${0.55 + 0.25 * Math.sin(i / 3)} 0.17 ${(i * 15) % 360})` }} />
          ))}
        </div>
        <h1>Hueroom</h1>
        <p>フォルダを選ぶと、画像が色のグラデーションでつながって並びます。</p>
        <div className="welcome-actions">
          <button type="button" className="btn primary" onClick={onPick}>
            フォルダを選ぶ
          </button>
          {restore.status === 'needs-permission' && (
            <button type="button" className="btn" onClick={onReopen}>
              前回のフォルダ「{restore.folderName}」を開く
            </button>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="fine">
          画像は端末の外に送信されません。
          {!persistent && ' このブラウザでは前回のフォルダを覚えられないため、毎回フォルダを選びます（Chrome / Edge なら次回から開き直せます）。'}
        </p>
      </div>
    </main>
  );
}
