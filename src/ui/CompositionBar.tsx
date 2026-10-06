import { COMPOSITION_HINT, COMPOSITION_LABEL, COMPOSITION_TAGS, type CompositionTag } from '../core/composition';

interface Props {
  tag: CompositionTag | null;
  onChange(t: CompositionTag | null): void;
  counts: Record<CompositionTag, number>;
}

/** 構図の傾向で絞り込む。同じチップをもう一度押すと解除 */
export function CompositionBar({ tag, onChange, counts }: Props) {
  return (
    <div className="compbar" role="group" aria-label="構図">
      <span className="comp-label">構図</span>
      {COMPOSITION_TAGS.map((t) => (
        <button
          key={t}
          type="button"
          className="comp-chip"
          data-tag={t}
          title={COMPOSITION_HINT[t]}
          aria-pressed={tag === t}
          disabled={counts[t] === 0 && tag !== t}
          onClick={() => onChange(tag === t ? null : t)}
        >
          {COMPOSITION_LABEL[t]} <span className="num">{counts[t].toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}
