import type { SortDirection, SortMode, SortableItem } from '../types';
import { sortByColor } from './hueBands';

const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });

/** 自然順（img2 < img10）の名前比較 */
export const compareNames = (a: string, b: string): number => collator.compare(a, b);

/** 並び替えの入口。入力は変更しない */
export function sortItems<T extends SortableItem>(
  items: readonly T[],
  mode: SortMode,
  direction: SortDirection = 'asc',
): T[] {
  if (mode === 'color') return sortByColor(items);
  const sign = direction === 'asc' ? 1 : -1;
  const out = [...items];
  if (mode === 'name') {
    out.sort((p, q) => sign * compareNames(p.name, q.name) || p.key.localeCompare(q.key));
  } else {
    out.sort((p, q) => sign * (p.lastModified - q.lastModified) || compareNames(p.name, q.name));
  }
  return out;
}

export { sortByColor, hueBandIndex, totalStepDistance } from './hueBands';
