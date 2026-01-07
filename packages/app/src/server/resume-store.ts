import type { ResumeStore } from './resume-store-types.ts';

import { getRequiredMuicvDatabase, tryGetCloudflareEnv } from './cloudflare-bindings.ts';
import { createD1ResumeStore } from './d1-resume-store.ts';

export type {
  CreateResumeParams,
  CreateResumeWithVersionParams,
  CreateResumeWithVersionResult,
  ResumeId,
  ResumeMeta,
  ResumeStore,
  ResumeVersion,
  ResumeVersionId,
  ResumeVersionMeta,
  SaveResumeVersionParams,
} from './resume-store-types.ts';

type GlobalWithResumeStore = typeof globalThis & {
  __muicvResumeStore?: ResumeStore;
  __muicvResumeStorePromise?: Promise<ResumeStore>;
};

const globalWithResumeStore = globalThis as GlobalWithResumeStore;

async function createResumeStore(): Promise<ResumeStore> {
  const env = tryGetCloudflareEnv();
  if (env) {
    const database = getRequiredMuicvDatabase(env);
    return createD1ResumeStore({ database });
  }

  const { createDefaultSqliteResumeStore } = await import('./sqlite-resume-store.ts');
  return createDefaultSqliteResumeStore();
}

export async function getResumeStore(): Promise<ResumeStore> {
  if (globalWithResumeStore.__muicvResumeStore) {
    return globalWithResumeStore.__muicvResumeStore;
  }

  if (!globalWithResumeStore.__muicvResumeStorePromise) {
    globalWithResumeStore.__muicvResumeStorePromise = createResumeStore();
  }

  globalWithResumeStore.__muicvResumeStore = await globalWithResumeStore.__muicvResumeStorePromise;
  return globalWithResumeStore.__muicvResumeStore;
}
