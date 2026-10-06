/** IndexedDB の最小ラッパー（外部ライブラリなし） */

export type StoreName = 'analysis' | 'handles' | 'favorites';
const STORES: StoreName[] = ['analysis', 'handles', 'favorites'];
const DB_NAME = 'hueroom';
const DB_VERSION = 1;

const dbs = new Map<string, Promise<IDBDatabase>>();

export function openDb(name: string = DB_NAME): Promise<IDBDatabase> {
  let p = dbs.get(name);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbs.set(name, p);
  }
  return p;
}

function run<T>(
  dbName: string,
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb(dbName).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export interface KV<V> {
  get(key: string): Promise<V | undefined>;
  set(key: string, value: V): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function kv<V>(store: StoreName, dbName: string = DB_NAME): KV<V> {
  return {
    get: (key) => run<V | undefined>(dbName, store, 'readonly', (s) => s.get(key)),
    set: (key, value) => run(dbName, store, 'readwrite', (s) => s.put(value, key)).then(() => undefined),
    delete: (key) => run(dbName, store, 'readwrite', (s) => s.delete(key)).then(() => undefined),
    keys: () => run<IDBValidKey[]>(dbName, store, 'readonly', (s) => s.getAllKeys()).then((k) => k.map(String)),
  };
}
