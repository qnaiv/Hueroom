import { describe, expect, it } from 'vitest';
import type { ImageFileRef } from '../../core/types';
import { createFsAccessAdapter } from './fsAccessAdapter';
import { createInputAdapter } from './inputAdapter';

async function collect(it: AsyncIterable<ImageFileRef>): Promise<string[]> {
  const out: string[] = [];
  for await (const r of it) out.push(r.path);
  return out.sort();
}

/** File System Access API の最小の偽物 */
interface FakeDir {
  kind: 'directory';
  name: string;
  values(): AsyncGenerator<unknown>;
}
function fakeDir(name: string, children: Record<string, string | FakeDir>): FakeDir {
  return {
    kind: 'directory' as const,
    name,
    async *values() {
      for (const [n, v] of Object.entries(children)) {
        yield typeof v === 'string'
          ? { kind: 'file' as const, name: n, getFile: async () => new File([v], n, { lastModified: 5 }) }
          : v;
      }
    },
  };
}

describe('FS Access アダプタの列挙', () => {
  const root = fakeDir('photos', {
    'a.jpg': 'x',
    'b.PNG': 'x',
    'notes.txt': 'x',
    '.hidden.jpg': 'x',
    trip: fakeDir('trip', { 'c.webp': 'x', 'd.gif': 'x', '.cache': fakeDir('.cache', { 'e.jpg': 'x' }) }),
  });
  const folder = { name: 'photos', native: root };

  it('サブフォルダを含めると、画像だけを相対パスで返す（隠しファイル・隠しフォルダは除く）', async () => {
    const paths = await collect(createFsAccessAdapter().listImages(folder, { recursive: true }));
    expect(paths).toEqual(['a.jpg', 'b.PNG', 'trip/c.webp', 'trip/d.gif']);
  });

  it('サブフォルダを含めない設定では、直下だけ', async () => {
    const paths = await collect(createFsAccessAdapter().listImages(folder, { recursive: false }));
    expect(paths).toEqual(['a.jpg', 'b.PNG']);
  });

  it('更新日時とサイズを持ち、実体を遅延読み込みできる', async () => {
    let seen = 0;
    for await (const r of createFsAccessAdapter().listImages(folder, { recursive: false })) {
      expect(r.lastModified).toBe(5);
      expect(r.size).toBe(1);
      expect((await r.getFile()).size).toBe(1);
      seen++;
    }
    expect(seen).toBe(2);
  });

  it('中断されたら列挙をやめる', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    expect(await collect(createFsAccessAdapter().listImages(folder, { recursive: true, signal: ctrl.signal }))).toEqual([]);
  });
});

describe('input フォールバックの列挙', () => {
  const file = (rel: string) => {
    const f = new File(['x'], rel.split('/').pop()!, { lastModified: 9 });
    Object.defineProperty(f, 'webkitRelativePath', { value: rel });
    return f;
  };
  const files = [
    file('photos/a.jpg'),
    file('photos/readme.md'),
    file('photos/trip/b.png'),
    file('photos/.git/c.jpg'),
    file('photos/trip/deep/d.webp'),
  ];
  const folder = { name: 'photos', native: files };

  it('選んだフォルダ名を除いた相対パスで返し、画像以外と隠しフォルダは除く', async () => {
    expect(await collect(createInputAdapter().listImages(folder, { recursive: true }))).toEqual([
      'a.jpg',
      'trip/b.png',
      'trip/deep/d.webp',
    ]);
  });

  it('サブフォルダを含めない設定では直下だけ', async () => {
    expect(await collect(createInputAdapter().listImages(folder, { recursive: false }))).toEqual(['a.jpg']);
  });

  it('前回のフォルダは覚えられない', async () => {
    const a = createInputAdapter();
    expect(a.capabilities.persistent).toBe(false);
    expect(await a.restoreLast()).toEqual({ status: 'none' });
  });
});
