import type { ConversationId, ResumeJson, UserId } from '@muicv/shared';

export type ResumeSnapshotId = string;

export type ResumeSnapshotMeta = {
  id: ResumeSnapshotId;
  userId: UserId;
  conversationId: ConversationId | null;
  createdAt: string;
};

export type ResumeSnapshot = ResumeSnapshotMeta & {
  resume: ResumeJson;
};

export type SaveResumeSnapshotParams = {
  userId: UserId;
  conversationId?: ConversationId;
  resume: ResumeJson;
};

export type ResumeStore = {
  getCurrentResume(userId: UserId): Promise<ResumeSnapshot | undefined>;
  listResumeSnapshots(userId: UserId): Promise<ResumeSnapshotMeta[]>;
  saveResumeSnapshot(params: SaveResumeSnapshotParams): Promise<ResumeSnapshotMeta>;
  rollbackResumeSnapshot(userId: UserId, snapshotId: ResumeSnapshotId): Promise<ResumeSnapshotMeta>;
};
