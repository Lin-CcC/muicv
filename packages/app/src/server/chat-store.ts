import type { ChatStore } from './chat-store-types.ts';

import { createD1ChatStore } from './d1-chat-store.ts';
import { getRequiredMuicvDatabase, tryGetCloudflareEnv } from './cloudflare-bindings.ts';

export type { AddMessageParams, ChatStore, CreateConversationParams } from './chat-store-types.ts';

type GlobalWithChatStore = typeof globalThis & {
  __muicvChatStore?: ChatStore;
  __muicvChatStorePromise?: Promise<ChatStore>;
};

const globalWithChatStore = globalThis as GlobalWithChatStore;

async function createChatStore(): Promise<ChatStore> {
  const env = tryGetCloudflareEnv();
  if (env) {
    const database = getRequiredMuicvDatabase(env);
    return createD1ChatStore({ database });
  }

  const { createDefaultSqliteChatStore } = await import('./sqlite-chat-store.ts');
  return createDefaultSqliteChatStore();
}

export async function getChatStore(): Promise<ChatStore> {
  if (globalWithChatStore.__muicvChatStore) {
    return globalWithChatStore.__muicvChatStore;
  }

  if (!globalWithChatStore.__muicvChatStorePromise) {
    globalWithChatStore.__muicvChatStorePromise = createChatStore();
  }

  globalWithChatStore.__muicvChatStore = await globalWithChatStore.__muicvChatStorePromise;
  return globalWithChatStore.__muicvChatStore;
}
