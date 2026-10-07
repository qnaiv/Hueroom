import { describe, expect, it } from 'vitest';
import type { ImageFileRef } from '../../core/types';
import { createFsAccessAdapter } from './fsAccessAdapter';
import { createInputAdapter, isIosLike, mergePicked } from './inputAdapter';

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

describe('写真を選ぶ方式（iPhone / iPad）', () => {
  const photo = (name: string, size = 1, type = 'image/jpeg', lastModified = 9) => {
    const f = new File(['x'.repeat(size)], name, { type, lastModified });
    return f;
  };
  const adapter = () => createInputAdapter({ mode: 'photos' });

  it('写真を選ぶ方式で、追加に対応している。フォルダを選ぶ方式は対応しない', () => {
    expect(adapter().capabilities).toMatchObject({ pickKind: 'photos', appendable: true, persistent: false });
    expect(createInputAdapter().capabilities).toMatchObject({ pickKind: 'folder', appendable: false });
  });

  it('相対パスが無くても、名前で返す。画像以外と隠しファイルは除く', async () => {
    const folder = { name: '選んだ写真', native: [photo('IMG_1.jpg'), photo('notes.txt', 1, 'text/plain'), photo('.hidden.jpg'), photo('b.png', 1, 'image/png')] };
    expect(await collect(adapter().listImages(folder, { recursive: true }))).toEqual(['IMG_1.jpg', 'b.png']);
  });

  it('HEIC など、拡張子が対象外でも、画像の MIME なら読む', async () => {
    const folder = { name: '選んだ写真', native: [photo('IMG_2.HEIC', 1, 'image/heic'), photo('data.bin', 1, 'application/octet-stream')] };
    expect(await collect(adapter().listImages(folder, { recursive: true }))).toEqual(['IMG_2.HEIC']);
  });

  it('同じ名前で中身が違う写真は、番号を足して区別する（画面の中で一意になる）', async () => {
    const folder = { name: '選んだ写真', native: [photo('image.jpg', 1), photo('image.jpg', 2), photo('image.jpg', 3)] };
    expect(await collect(adapter().listImages(folder, { recursive: true }))).toEqual(['image.jpg', 'image.jpg (2)', 'image.jpg (3)']);
  });

  it('サブフォルダの設定に関わらず、すべて返す', async () => {
    const folder = { name: '選んだ写真', native: [photo('a.jpg'), photo('b.jpg')] };
    expect(await collect(adapter().listImages(folder, { recursive: false }))).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('mergePicked（写真を追加で選ぶ）', () => {
  const f = (name: string, size: number, lastModified = 1) => new File(['x'.repeat(size)], name, { lastModified });

  it('あとから選んだ写真を足す。順序は、先に選んだものが先', () => {
    const merged = mergePicked([f('a.jpg', 1), f('b.jpg', 1)], [f('c.jpg', 1)]);
    expect(merged.map((x) => x.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('同じ写真（名前・サイズ・更新日時が同じ）を、もう一度選んでも、重ならない', () => {
    const merged = mergePicked([f('a.jpg', 1), f('b.jpg', 2)], [f('b.jpg', 2), f('c.jpg', 3)]);
    expect(merged.map((x) => x.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('名前が同じでも、サイズか更新日時が違えば、別の写真', () => {
    const merged = mergePicked([f('image.jpg', 1, 1)], [f('image.jpg', 2, 1), f('image.jpg', 1, 2)]);
    expect(merged).toHaveLength(3);
  });
});

describe('isIosLike', () => {
  it('iPhone / iPad / iPod を見分ける', () => {
    expect(isIosLike({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' })).toBe(true);
    expect(isIosLike({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15' })).toBe(true);
  });

  it('iPadOS の Safari は Macintosh と名乗るので、タッチの数で見分ける。Mac は除く', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
    expect(isIosLike({ userAgent: mac, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIosLike({ userAgent: mac, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });

  it('Android と PC は、対象外', () => {
    expect(isIosLike({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', platform: 'Linux armv81', maxTouchPoints: 5 })).toBe(false);
    expect(isIosLike({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', platform: 'Win32', maxTouchPoints: 0 })).toBe(false);
  });
});
