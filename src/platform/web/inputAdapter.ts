import { isHiddenName, isImageName } from '../../core/images';
import type { ImageFileRef } from '../../core/types';
import type { FolderAdapter, FolderHandle, ListOptions } from '../types';

/** `<input webkitdirectory>` で選んだファイル群 */
type PickedFiles = File[];

const relPath = (f: File): string => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);

/** Safari / Firefox 向けのフォールバック。フォルダは覚えられないので毎回選ぶ */
export function createInputAdapter(): FolderAdapter {
  return {
    capabilities: { persistent: false, watch: false },

    pickFolder() {
      return new Promise<FolderHandle | null>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.setAttribute('webkitdirectory', '');
        input.hidden = true;
        document.body.append(input);
        const cleanup = () => input.remove();
        input.onchange = () => {
          const files: PickedFiles = Array.from(input.files ?? []);
          cleanup();
          if (files.length === 0) return resolve(null);
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
      for (const file of folder.native as PickedFiles) {
        if (opts.signal?.aborted) return;
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
