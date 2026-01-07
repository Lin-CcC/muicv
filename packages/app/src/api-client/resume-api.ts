import type { ResumeJson } from '@muicv/shared';

import { fetchJson } from './fetch-json';

export type ResumeSnapshotMeta = {
  id: string;
  conversationId: string | null;
  createdAt: string;
};

export type GetResumeResponse = {
  current: ResumeJson | null;
  currentSnapshotId?: string;
  snapshots: ResumeSnapshotMeta[];
  retentionLimit: number;
};

export async function getResume(): Promise<GetResumeResponse> {
  return fetchJson<GetResumeResponse>('/api/resume', { method: 'GET' });
}

export async function rollbackResumeSnapshot(snapshotId: string): Promise<ResumeSnapshotMeta> {
  return fetchJson<ResumeSnapshotMeta>(`/api/resume/snapshots/${snapshotId}/rollback`, { method: 'POST' });
}
