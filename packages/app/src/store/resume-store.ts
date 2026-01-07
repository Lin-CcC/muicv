'use client';

import { create } from 'zustand';

import type { ResumeJson } from '@muicv/shared';
import type { ResumeSnapshotMeta } from '@/src/api-client/resume-api';
import { getResume, rollbackResumeSnapshot } from '@/src/api-client/resume-api';

type ResumeStoreState = {
  current: ResumeJson | null;
  currentSnapshotId: string | undefined;
  snapshots: ResumeSnapshotMeta[];
  retentionLimit: number;
  isLoading: boolean;
  isRollingBackSnapshotId: string | undefined;
  errorMessage: string | undefined;
};

type ResumeStoreActions = {
  loadResume(): Promise<void>;
  rollbackSnapshot(snapshotId: string): Promise<void>;
  clearError(): void;
};

export type ResumeStore = ResumeStoreState & ResumeStoreActions;

export const useResumeStore = create<ResumeStore>((set, get) => ({
  current: null,
  currentSnapshotId: undefined,
  snapshots: [],
  retentionLimit: 10,
  isLoading: false,
  isRollingBackSnapshotId: undefined,
  errorMessage: undefined,

  clearError() {
    set({ errorMessage: undefined });
  },

  async loadResume() {
    if (get().isLoading) return;
    set({ isLoading: true, errorMessage: undefined });

    try {
      const response = await getResume();
      set({
        current: response.current,
        currentSnapshotId: response.currentSnapshotId,
        retentionLimit: response.retentionLimit,
        snapshots: response.snapshots,
      });
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '加载简历失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  async rollbackSnapshot(snapshotId: string) {
    if (get().isRollingBackSnapshotId) return;
    set({ isRollingBackSnapshotId: snapshotId, errorMessage: undefined });

    try {
      await rollbackResumeSnapshot(snapshotId);
      await get().loadResume();
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '回滚失败' });
    } finally {
      set({ isRollingBackSnapshotId: undefined });
    }
  },
}));
