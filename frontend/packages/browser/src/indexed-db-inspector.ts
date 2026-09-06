import { decodeBlob, decodeKeyBlob } from '../../runtime-client/src/storage/indexed-db-inspector-value';
import type { DbEntryView, IndexedDbMeta } from '../../runtime-client/src/storage/indexed-db-inspector-key';

const requireIndexedDb = (): IDBFactory => {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
  return indexedDB;
};
export const listInspectableDatabases = async (): Promise<IndexedDbMeta[]> => {
  const factory = requireIndexedDb();
  if (typeof factory.databases !== 'function') throw new Error('This browser does not support IndexedDB database discovery');
  return (await factory.databases()).flatMap(entry => typeof entry.name === 'string' && entry.name.startsWith('level-js-db-')
    ? [{ name: entry.name, ...(entry.version === undefined ? {} : { version: entry.version }) }] : []).sort((a, b) => a.name.localeCompare(b.name));
};
const openExistingDatabase = (name: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = requireIndexedDb().open(name);
  let cancelled = false;
  request.onupgradeneeded = () => {
    // Opening a deleted database would otherwise create it. Inspection never
    // owns schema creation, including a deletion racing database discovery.
    request.transaction?.abort();
    reject(new Error(`INSPECTOR_DATABASE_NO_LONGER_EXISTS:${name}`));
  };
  request.onerror = () => reject(request.error ?? new Error(`INSPECTOR_DATABASE_OPEN_FAILED:${name}`));
  request.onblocked = () => { cancelled = true; reject(new Error(`INSPECTOR_DATABASE_OPEN_BLOCKED:${name}`)); };
  request.onsuccess = () => { if (cancelled) request.result.close(); else resolve(request.result); };
});
export const listInspectableStores = async (name: string): Promise<string[]> => {
  const db = await openExistingDatabase(name);
  try { return [...db.objectStoreNames].sort(); }
  finally { db.close(); }
};
export const readInspectableEntries = async (database: string, storeName: string, offset: number, pageSize = 50) => {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error('INSPECTOR_PAGE_INVALID');
  const db = await openExistingDatabase(database);
  try {
    return await new Promise<{ entries: DbEntryView[]; hasMore: boolean }>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).openCursor();
      const entries: DbEntryView[] = [];
      let index = 0;
      transaction.onabort = () => reject(transaction.error ?? new Error('INSPECTOR_READ_ABORTED'));
      transaction.onerror = () => reject(transaction.error ?? new Error('INSPECTOR_READ_FAILED'));
      request.onerror = () => reject(request.error ?? new Error('INSPECTOR_CURSOR_FAILED'));
      request.onsuccess = () => {
        try {
          const cursor = request.result;
          if (!cursor) { resolve({ entries, hasMore: false }); return; }
          if (index >= offset) {
            if (entries.length >= pageSize) { resolve({ entries, hasMore: true }); return; }
            const key = decodeKeyBlob(cursor.key);
            entries.push({ index, key, value: decodeBlob(cursor.value, key.keyFields) });
          }
          index += 1;
          cursor.continue();
        } catch (cause) { reject(cause); transaction.abort(); }
      };
    });
  } finally { db.close(); }
};
