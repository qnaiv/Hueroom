import type { FolderAdapter } from '../types';
import { createFsAccessAdapter } from './fsAccessAdapter';
import { createInputAdapter } from './inputAdapter';

/**
 * Web 版のアダプタを機能検出で選ぶ。
 * `?adapter=input` を付けるとフォールバック版を強制できる（自動テストやスクリーンショット用）。
 */
export function createWebAdapter(): FolderAdapter {
  const forced = new URLSearchParams(location.search).get('adapter') === 'input';
  if (!forced && typeof window.showDirectoryPicker === 'function') return createFsAccessAdapter();
  return createInputAdapter();
}
