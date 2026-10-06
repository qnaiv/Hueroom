import type { SortDirection, SortMode, SortableItem } from '../types';
import { sortByColor } from './hueBands';

/**
 * 並び替えの入口。入力は変更しない。
 * 日付順は撮影日時（無ければ更新日時）で並べ、同時刻はキーで安定させる。
 * direction は日付順だけに効く（desc = 新しい順）。
 */
export function sortItems<T extends SortableItem>(
  items: readonly T[],
  mode: SortMode,
  direction: SortDirection = 'desc',
): T[] {
  if (mode === 'color') return sortByColor(items);
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((p, q) => sign * (p.shotAt - q.shotAt) || p.key.localeCompare(q.key));
}

export { sortByColor, hueBandIndex, totalStepDistance } from './hueBands';
