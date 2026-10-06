import { kv, type KV } from '../storage/idb';

/** お気に入り。キーは色キャッシュと同じ imageKey() */
export class FavoritesStore {
  private readonly store: KV<true>;
  private readonly keys = new Set<string>();

  constructor(dbName?: string) {
    this.store = kv<true>('favorites', dbName);
  }

  async load(): Promise<Set<string>> {
    this.keys.clear();
    for (const k of await this.store.keys()) this.keys.add(k);
    return new Set(this.keys);
  }

  has(key: string): boolean {
    return this.keys.has(key);
  }

  /** 切り替え後の状態（true = お気に入り）を返す */
  async toggle(key: string): Promise<boolean> {
    if (this.keys.has(key)) {
      this.keys.delete(key);
      await this.store.delete(key);
      return false;
    }
    this.keys.add(key);
    await this.store.set(key, true);
    return true;
  }
}
