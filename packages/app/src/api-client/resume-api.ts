import type { ConversationId, ResumeJson } from '@muicv/shared';

import { fetchJson } from './fetch-json';

export type ResumeMeta = {
  id: string;
  userId: string;
  title: string;
  sourceConversationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResumeVersionMeta = {
  id: string;
  resumeId: string;
  userId: string;
  createdAt: string;
};

export type ListResumesResponse = ResumeMeta[];

export async function listResumes(): Promise<ListResumesResponse> {
  return fetchJson<ListResumesResponse>('/api/resume', { method: 'GET' });
}

export type CreateResumeResponse = {
  resume: ResumeMeta;
  version: ResumeVersionMeta;
};

export async function createResume(params?: {
  title?: string;
  sourceConversationId?: ConversationId;
}): Promise<CreateResumeResponse> {
  const title = params?.title?.trim();
  const sourceConversationId = params?.sourceConversationId?.trim();
  return fetchJson<CreateResumeResponse>('/api/resume', {
    body: JSON.stringify({
      ...(title ? { title } : {}),
      ...(sourceConversationId ? { sourceConversationId } : {}),
    }),
    method: 'POST',
  });
}

export type GetResumeResponse = {
  resume: ResumeMeta;
  current: ResumeJson | null;
  currentVersionId?: string;
  versions: ResumeVersionMeta[];
  retentionLimit: number;
};

export async function getResume(resumeId: string): Promise<GetResumeResponse> {
  return fetchJson<GetResumeResponse>(`/api/resume/${resumeId}`, { method: 'GET' });
}

export async function renameResume(resumeId: string, title: string): Promise<ResumeMeta> {
  return fetchJson<ResumeMeta>(`/api/resume/${resumeId}`, {
    body: JSON.stringify({ title }),
    method: 'PATCH',
  });
}

export async function deleteResume(resumeId: string): Promise<void> {
  await fetchJson<{ ok: true }>(`/api/resume/${resumeId}`, { method: 'DELETE' });
}

export async function listResumeVersions(resumeId: string): Promise<ResumeVersionMeta[]> {
  return fetchJson<ResumeVersionMeta[]>(`/api/resume/${resumeId}/versions`, { method: 'GET' });
}

export async function saveResumeVersion(resumeId: string, resume: ResumeJson): Promise<ResumeVersionMeta> {
  return fetchJson<ResumeVersionMeta>(`/api/resume/${resumeId}/versions`, {
    body: JSON.stringify({ resume }),
    method: 'POST',
  });
}

export async function rollbackResumeVersion(resumeId: string, versionId: string): Promise<ResumeVersionMeta> {
  return fetchJson<ResumeVersionMeta>(`/api/resume/${resumeId}/versions/${versionId}/rollback`, { method: 'POST' });
}

export type AiProviderId = 'openai' | 'gemini';

export type GenerateResumeParams = {
  conversationId?: ConversationId;
  title?: string;
  provider?: AiProviderId;
  model?: string;
  memoryLimit?: number;
  messageLimit?: number;
};

export type GenerateResumeResponse = {
  resume: ResumeJson;
  usedMemoryEntries: number;
  usedMessages: number;
  saved: {
    wasCreated: boolean;
    resume: ResumeMeta;
    version: ResumeVersionMeta;
  };
};

export async function generateResume(params?: GenerateResumeParams): Promise<GenerateResumeResponse> {
  const conversationId = params?.conversationId?.trim();
  const title = params?.title?.trim();
  return fetchJson<GenerateResumeResponse>('/api/resume/generate', {
    body: JSON.stringify({
      ...(conversationId ? { conversationId } : {}),
      ...(title ? { title } : {}),
      ...(params?.provider ? { provider: params.provider } : {}),
      ...(params?.model?.trim() ? { model: params.model.trim() } : {}),
      ...(params?.memoryLimit !== undefined ? { memoryLimit: params.memoryLimit } : {}),
      ...(params?.messageLimit !== undefined ? { messageLimit: params.messageLimit } : {}),
    }),
    method: 'POST',
  });
}
