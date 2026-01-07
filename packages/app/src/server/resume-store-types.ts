import type { ConversationId, ResumeJson, UserId } from '@muicv/shared';

export type ResumeId = string;
export type ResumeVersionId = string;

export type ResumeMeta = {
  id: ResumeId;
  userId: UserId;
  title: string;
  sourceConversationId: ConversationId | null;
  createdAt: string;
  updatedAt: string;
};

export type ResumeVersionMeta = {
  id: ResumeVersionId;
  resumeId: ResumeId;
  userId: UserId;
  createdAt: string;
};

export type ResumeVersion = ResumeVersionMeta & {
  resume: ResumeJson;
};

export type CreateResumeParams = {
  userId: UserId;
  title?: string;
  sourceConversationId?: ConversationId;
};

export type SaveResumeVersionParams = {
  userId: UserId;
  resumeId: ResumeId;
  resume: ResumeJson;
};

export type CreateResumeWithVersionParams = CreateResumeParams & {
  resume: ResumeJson;
};

export type CreateResumeWithVersionResult = {
  resume: ResumeMeta;
  version: ResumeVersionMeta;
};

export type ResumeStore = {
  listResumes(userId: UserId): Promise<ResumeMeta[]>;
  getResume(userId: UserId, resumeId: ResumeId): Promise<ResumeMeta | undefined>;

  createResume(params: CreateResumeParams): Promise<ResumeMeta>;
  createResumeWithVersion(params: CreateResumeWithVersionParams): Promise<CreateResumeWithVersionResult>;
  renameResume(userId: UserId, resumeId: ResumeId, title: string): Promise<ResumeMeta>;
  deleteResume(userId: UserId, resumeId: ResumeId): Promise<void>;

  getCurrentResumeVersion(userId: UserId, resumeId: ResumeId): Promise<ResumeVersion | undefined>;
  listResumeVersions(userId: UserId, resumeId: ResumeId): Promise<ResumeVersionMeta[]>;
  saveResumeVersion(params: SaveResumeVersionParams): Promise<ResumeVersionMeta>;
  rollbackResumeVersion(userId: UserId, resumeId: ResumeId, versionId: ResumeVersionId): Promise<ResumeVersionMeta>;
};
