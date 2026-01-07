'use client';

import { create } from 'zustand';

import type { ConversationId, MemoryEntry } from '@muicv/shared';
import { listMemoryEntries, organizeMemoryEntries } from '@/src/api-client/memory-api';

type MemoryStoreState = {
  entries: MemoryEntry[];
  conversationId: ConversationId | undefined;
  isLoading: boolean;
  isOrganizing: boolean;
  errorMessage: string | undefined;
  lastOrganizeSummary?: { created: number; skipped: number };
};

type MemoryStoreActions = {
  loadEntries(conversationId?: ConversationId): Promise<void>;
  organizeEntries(conversationId?: ConversationId): Promise<void>;
  clearError(): void;
};

export type MemoryStore = MemoryStoreState & MemoryStoreActions;

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  entries: [],
  conversationId: undefined,
  isLoading: false,
  isOrganizing: false,
  errorMessage: undefined,

  clearError() {
    set({ errorMessage: undefined });
  },

  async loadEntries(conversationId?: ConversationId) {
    if (get().isLoading) return;
    set({ isLoading: true, errorMessage: undefined, conversationId });

    try {
      const entries = await listMemoryEntries({
        ...(conversationId ? { conversationId } : {}),
        limit: 50,
      });
      set({ entries });
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '加载记录失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  async organizeEntries(conversationId?: ConversationId) {
    if (get().isOrganizing) return;

    const targetConversationId = conversationId ?? get().conversationId;
    set({ isOrganizing: true, errorMessage: undefined });

    try {
      const result = await organizeMemoryEntries({
        ...(targetConversationId ? { conversationId: targetConversationId } : {}),
        limit: 30,
      });

      set({
        lastOrganizeSummary: {
          created: result.createdEntries.length,
          skipped: result.skipped,
        },
      });

      const entries = await listMemoryEntries({
        ...(targetConversationId ? { conversationId: targetConversationId } : {}),
        limit: 50,
      });
      set({ entries, conversationId: targetConversationId });
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '整理记录失败' });
    } finally {
      set({ isOrganizing: false });
    }
  },
}));
