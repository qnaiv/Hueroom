import { describe, expect, it } from 'vitest';
import type { SortableItem } from '../types';
import { sortItems } from './index';

const mk = (name: string, lastModified: number): SortableItem => ({ key: name, name, lastModified });

describe('sortItems', () => {
  const items = [mk('img10.jpg', 300), mk('img2.jpg', 100), mk('IMG1.jpg', 200), mk('あ.png', 50)];

  it('名前順は自然順（2 が 10 より前、大文字小文字は区別しない）', () => {
    expect(sortItems(items, 'name').map((x) => x.name)).toEqual(['IMG1.jpg', 'img2.jpg', 'img10.jpg', 'あ.png']);
  });

  it('名前順の降順', () => {
    expect(sortItems(items, 'name', 'desc').map((x) => x.name)[0]).toBe('あ.png');
  });

  it('更新日時順（昇順・降順）', () => {
    expect(sortItems(items, 'date', 'asc').map((x) => x.lastModified)).toEqual([50, 100, 200, 300]);
    expect(sortItems(items, 'date', 'desc').map((x) => x.lastModified)).toEqual([300, 200, 100, 50]);
  });

  it('入力を変更しない', () => {
    const copy = [...items];
    sortItems(items, 'name');
    expect(items).toEqual(copy);
  });
});
