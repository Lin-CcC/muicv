import type { MemoryStore } from './memory-store-types.ts';

import { getRequiredMuicvDatabase, tryGetCloudflareEnv } from './cloudflare-bindings.ts';
import { createD1MemoryStore } from './d1-memory-store.ts';

export type {
  CreateMemoryEntryParams,
  ListMemoryEntriesParams,
  MemoryEntry,
  MemoryEntryKind,
  MemoryStore,
} from './memory-store-types.ts';

type GlobalWithMemoryStore = typeof globalThis & {
  __muicvMemoryStore?: MemoryStore;
  __muicvMemoryStorePromise?: Promise<MemoryStore>;
};

const globalWithMemoryStore = globalThis as GlobalWithMemoryStore;

async function createMemoryStore(): Promise<MemoryStore> {
  const env = tryGetCloudflareEnv();
  if (env) {
    const database = getRequiredMuicvDatabase(env);
    return createD1MemoryStore({ database });
  }

  const { createDefaultSqliteMemoryStore } = await import('./sqlite-memory-store.ts');
  return createDefaultSqliteMemoryStore();
}

export async function getMemoryStore(): Promise<MemoryStore> {
  if (globalWithMemoryStore.__muicvMemoryStore) {
    return globalWithMemoryStore.__muicvMemoryStore;
  }

  if (!globalWithMemoryStore.__muicvMemoryStorePromise) {
    globalWithMemoryStore.__muicvMemoryStorePromise = createMemoryStore();
  }

  globalWithMemoryStore.__muicvMemoryStore = await globalWithMemoryStore.__muicvMemoryStorePromise;
  return globalWithMemoryStore.__muicvMemoryStore;
}
