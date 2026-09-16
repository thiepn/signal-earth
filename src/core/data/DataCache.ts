import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProviderId } from '../../shared/types/sources';

export interface CacheEntry<T = unknown> {
  key: string;
  provider: ProviderId;
  fetchedAt: number;
  sourceUpdatedAt?: number;
  expiresAt: number;
  schemaVersion: number;
  providerVersion: string;
  value: T;
}

interface SignalEarthCacheSchema extends DBSchema {
  snapshots: {
    key: string;
    value: CacheEntry;
    indexes: { 'by-provider': ProviderId };
  };
}

export class DataCache {
  #dbPromise: Promise<IDBPDatabase<SignalEarthCacheSchema>> | null = null;

  #db(): Promise<IDBPDatabase<SignalEarthCacheSchema>> {
    this.#dbPromise ??= openDB<SignalEarthCacheSchema>('signal-earth', 1, {
      upgrade(db) {
        const store = db.createObjectStore('snapshots', { keyPath: 'key' });
        store.createIndex('by-provider', 'provider');
      },
    });
    return this.#dbPromise;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const db = await this.#db();
    return (await db.get('snapshots', key)) as CacheEntry<T> | undefined;
  }

  async set<T>(entry: CacheEntry<T>): Promise<void> {
    const db = await this.#db();
    await db.put('snapshots', entry as CacheEntry);
  }

  async delete(key: string): Promise<void> {
    const db = await this.#db();
    await db.delete('snapshots', key);
  }

  async clearProvider(provider: ProviderId): Promise<void> {
    const db = await this.#db();
    const tx = db.transaction('snapshots', 'readwrite');
    let cursor = await tx.store.index('by-provider').openCursor(provider);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}
