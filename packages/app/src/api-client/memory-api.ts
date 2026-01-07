import type { ConversationId, MemoryEntry } from '@muicv/shared';

import { fetchJson } from './fetch-json';

export type ListMemoryEntriesParams = {
  conversationId?: ConversationId;
  limit?: number;
};

export async function listMemoryEntries(params?: ListMemoryEntriesParams): Promise<MemoryEntry[]> {
  const url = new URL('/api/memories', window.location.origin);
  const conversationId = params?.conversationId?.trim();
  if (conversationId) {
    url.searchParams.set('conversationId', conversationId);
  }

  const limit = params?.limit;
  if (limit !== undefined) {
    url.searchParams.set('limit', String(limit));
  }

  return fetchJson<MemoryEntry[]>(url, { method: 'GET' });
}

export type OrganizeMemoryEntriesParams = {
  conversationId?: ConversationId;
  limit?: number;
};

export type OrganizeMemoryEntriesResponse = {
  createdEntries: MemoryEntry[];
  skipped: number;
};

export async function organizeMemoryEntries(
  params?: OrganizeMemoryEntriesParams,
): Promise<OrganizeMemoryEntriesResponse> {
  const url = new URL('/api/memories/organize', window.location.origin);
  const conversationId = params?.conversationId?.trim();

  return fetchJson<OrganizeMemoryEntriesResponse>(url, {
    body: JSON.stringify({
      ...(conversationId ? { conversationId } : {}),
      ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    }),
    method: 'POST',
  });
}
