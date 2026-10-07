import type { FolderAdapter } from '../types';
import { createFsAccessAdapter } from './fsAccessAdapter';
import { createInputAdapter, isIosLike } from './inputAdapter';

/**
 * Web 版のアダプタを機能検出で選ぶ。
 * `?adapter=input`（フォルダを選ぶフォールバック）、`?adapter=photos`（写真を複数選ぶ）を付けると、
 * その版を強制できる（自動テストやスクリーンショット用）。
 * iPhone / iPad の Safari は、フォルダを選べないので、写真を複数選ぶ方式になる。
 */
export function createWebAdapter(): FolderAdapter {
  const forced = new URLSearchParams(location.search).get('adapter');
  if (forced === 'photos') return createInputAdapter({ mode: 'photos' });
  if (forced === 'input') return createInputAdapter();
  if (typeof window.showDirectoryPicker === 'function') return createFsAccessAdapter();
  return createInputAdapter({ mode: isIosLike(navigator) ? 'photos' : 'folder' });
}
