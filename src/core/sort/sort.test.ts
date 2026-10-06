import { describe, expect, it } from 'vitest';
import type { SortableItem } from '../types';
import { sortItems } from './index';

const mk = (key: string, shotAt: number): SortableItem => ({ key, name: key, lastModified: 0, shotAt });

describe('sortItems（日付順）', () => {
  const items = [mk('b', 300), mk('a', 100), mk('c', 200), mk('d', 50)];

  it('既定は新しい順', () => {
    expect(sortItems(items, 'date').map((x) => x.shotAt)).toEqual([300, 200, 100, 50]);
  });

  it('古い順にもできる', () => {
    expect(sortItems(items, 'date', 'asc').map((x) => x.shotAt)).toEqual([50, 100, 200, 300]);
  });

  it('同じ時刻はキーの順で安定する', () => {
    const same = [mk('z', 10), mk('a', 10), mk('m', 10)];
    expect(sortItems(same, 'date').map((x) => x.key)).toEqual(['a', 'm', 'z']);
    expect(sortItems([...same].reverse(), 'date').map((x) => x.key)).toEqual(['a', 'm', 'z']);
  });

  it('入力を変更しない', () => {
    const copy = [...items];
    sortItems(items, 'date');
    expect(items).toEqual(copy);
  });

  it('色順は direction に関係しない', () => {
    expect(sortItems(items, 'color', 'asc')).toEqual(sortItems(items, 'color', 'desc'));
  });
});
