import { isHiddenName, isImageName } from '../../core/images';
import type { ImageFileRef } from '../../core/types';
import type { FolderAdapter, FolderHandle, ListOptions, PickOptions } from '../types';

/** `<input>` で選んだファイル群 */
type PickedFiles = File[];

const relPath = (f: File): string => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);

/** 写真を選ぶ方式での、選択のまとまりの名前（画面の左上に出る） */
export const PHOTOS_FOLDER_NAME = '選んだ写真';

/**
 * iPhone / iPad か。Safari はフォルダを選べない（`webkitdirectory` が効かない）ので、写真を選ぶ方式にする。
 * iPadOS 13 以降の Safari は「Macintosh」と名乗るので、タッチの数でも見分ける。
 */
export function isIosLike(nav: { userAgent: string; platform?: string; maxTouchPoints?: number }): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/** 同じ写真（名前・サイズ・更新日時が同じ）は 1 つにして、あとから選んだものを足す */
export function mergePicked(prev: readonly File[], next: readonly File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of [...prev, ...next]) {
    const key = `${f.name}|${f.size}|${f.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/**
 * 写真を選ぶ方式で、画像として読むか。iPhone の写真は HEIC のこともあるので、拡張子だけでなく MIME も見る
 * （Safari はデコードできる。読めない環境では、解析に失敗した画像として扱われる）
 */
const isPickedImage = (f: File): boolean => isImageName(f.name) || f.type.startsWith('image/');

interface InputAdapterOptions {
  /** 'folder': フォルダを選ぶ（`webkitdirectory`）。'photos': 写真を複数選ぶ（iPhone / iPad） */
  mode?: 'folder' | 'photos';
}

/**
 * Safari / Firefox 向けのフォールバック。フォルダは覚えられないので毎回選ぶ。
 * mode: 'photos' は、フォルダを選べない iPhone / iPad 向けで、写真を複数選ぶ。
 * 一度に選びきれないときのために、追加で選べる（append）。
 */
export function createInputAdapter({ mode = 'folder' }: InputAdapterOptions = {}): FolderAdapter {
  const photos = mode === 'photos';
  // 写真を選ぶ方式で、これまでに選んだ写真
  let picked: File[] = [];

  return {
    capabilities: { persistent: false, watch: false, pickKind: photos ? 'photos' : 'folder', appendable: photos },

    pickFolder({ append = false }: PickOptions = {}) {
      return new Promise<FolderHandle | null>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        if (photos) input.accept = 'image/*';
        else input.setAttribute('webkitdirectory', '');
        input.hidden = true;
        document.body.append(input);
        const cleanup = () => input.remove();
        input.onchange = () => {
          const files: PickedFiles = Array.from(input.files ?? []);
          cleanup();
          if (files.length === 0) return resolve(null);
          if (photos) {
            picked = mergePicked(append ? picked : [], files);
            return resolve({ name: PHOTOS_FOLDER_NAME, native: picked });
          }
          const root = relPath(files[0] as File).split('/')[0] ?? 'フォルダ';
          resolve({ name: root, native: files });
        };
        input.oncancel = () => {
          cleanup();
          resolve(null);
        };
        input.click();
      });
    },

    async restoreLast() {
      return { status: 'none' };
    },

    async *listImages(folder: FolderHandle, opts: ListOptions): AsyncGenerator<ImageFileRef> {
      // 写真を選ぶ方式は、名前が同じで中身が違う写真があり得る。画面の中で区別できるよう、番号を足す
      const used = new Map<string, number>();
      for (const file of folder.native as PickedFiles) {
        if (opts.signal?.aborted) return;
        if (photos) {
          if (isHiddenName(file.name) || !isPickedImage(file)) continue;
          const n = (used.get(file.name) ?? 0) + 1;
          used.set(file.name, n);
          const path = n === 1 ? file.name : `${file.name} (${n})`;
          yield { path, name: file.name, lastModified: file.lastModified, size: file.size, getFile: async () => file };
          continue;
        }
        // 先頭（選んだフォルダ名）を除いた相対パス
        const parts = relPath(file).split('/').slice(1);
        const path = parts.join('/') || file.name;
        if (parts.length > 1 && !opts.recursive) continue;
        if (parts.some(isHiddenName) || !isImageName(file.name)) continue;
        yield { path, name: file.name, lastModified: file.lastModified, size: file.size, getFile: async () => file };
      }
    },
  };
}
