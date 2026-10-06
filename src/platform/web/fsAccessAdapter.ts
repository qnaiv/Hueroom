import { isHiddenName, isImageName } from '../../core/images';
import { kv } from '../../core/storage/idb';
import type { ImageFileRef } from '../../core/types';
import type { FolderAdapter, FolderHandle, ListOptions, RestoreResult } from '../types';

const LAST_KEY = 'last';
const handles = () => kv<FileSystemDirectoryHandle>('handles');

const toFolder = (dir: FileSystemDirectoryHandle): FolderHandle => ({ name: dir.name, native: dir });

/** 再帰的にディレクトリを辿って画像を列挙する */
async function* walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  opts: ListOptions,
): AsyncGenerator<ImageFileRef> {
  const subdirs: [string, FileSystemDirectoryHandle][] = [];
  for await (const entry of dir.values()) {
    if (opts.signal?.aborted) return;
    if (isHiddenName(entry.name)) continue;
    if (entry.kind === 'directory') {
      subdirs.push([entry.name, entry as FileSystemDirectoryHandle]);
    } else if (isImageName(entry.name)) {
      const fileHandle = entry as FileSystemFileHandle;
      let file: File;
      try {
        file = await fileHandle.getFile();
      } catch {
        continue; // 読み取れないファイルは飛ばす
      }
      yield {
        path: prefix + entry.name,
        name: entry.name,
        lastModified: file.lastModified,
        size: file.size,
        getFile: () => fileHandle.getFile(),
      };
    }
  }
  if (!opts.recursive) return;
  for (const [name, sub] of subdirs) yield* walk(sub, `${prefix}${name}/`, opts);
}

/** Chrome / Edge 向け。ディレクトリハンドルを IndexedDB に保存し、次回は許可の再確認だけで開く */
export function createFsAccessAdapter(): FolderAdapter {
  return {
    capabilities: { persistent: true, watch: false },

    async pickFolder() {
      try {
        const dir = await window.showDirectoryPicker!({ id: 'hueroom', mode: 'read' });
        await handles().set(LAST_KEY, dir).catch(() => undefined);
        return toFolder(dir);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return null;
        throw e;
      }
    },

    async restoreLast(): Promise<RestoreResult> {
      const dir = await handles().get(LAST_KEY).catch(() => undefined);
      if (!dir) return { status: 'none' };
      let state: PermissionState;
      try {
        state = await dir.queryPermission({ mode: 'read' });
      } catch {
        return { status: 'none' };
      }
      if (state === 'granted') return { status: 'ok', folder: toFolder(dir) };
      return {
        status: 'needs-permission',
        folderName: dir.name,
        // requestPermission はユーザー操作の中でしか呼べないので、呼び出し側のクリックから実行する
        request: async () => ((await dir.requestPermission({ mode: 'read' })) === 'granted' ? toFolder(dir) : null),
      };
    },

    listImages(folder, opts) {
      return walk(folder.native as FileSystemDirectoryHandle, '', opts);
    },
  };
}
