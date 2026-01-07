'use client';

import { create } from 'zustand';

import type { ConversationId, ResumeJson } from '@muicv/shared';
import type { ResumeMeta, ResumeVersionMeta } from '@/src/api-client/resume-api';
import {
  createResume,
  deleteResume,
  generateResume,
  getResume,
  listResumes,
  renameResume,
  rollbackResumeVersion,
  saveResumeVersion,
} from '@/src/api-client/resume-api';

type ResumeStoreState = {
  resumes: ResumeMeta[];
  activeResumeId: string | undefined;
  activeResume: ResumeMeta | undefined;
  current: ResumeJson | null;
  currentVersionId: string | undefined;
  versions: ResumeVersionMeta[];
  retentionLimit: number;

  isLoadingResumes: boolean;
  isLoadingActiveResume: boolean;
  isCreating: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  isRollingBackVersionId: string | undefined;

  draftText: string;
  generatedPreview: ResumeJson | null;
  lastGenerateSummary: { usedMemoryEntries: number; usedMessages: number } | undefined;
  errorMessage: string | undefined;
};

type ResumeStoreActions = {
  clearError(): void;

  loadResumes(): Promise<void>;
  setActiveResumeId(resumeId: string): Promise<void>;
  loadActiveResume(): Promise<void>;

  createNewResume(title?: string): Promise<void>;
  renameActiveResume(title: string): Promise<void>;
  deleteActiveResume(): Promise<void>;

  setDraftText(text: string): void;
  resetDraftFromCurrent(): void;
  applyPreviewToDraft(): void;

  generateAndSave(conversationId?: ConversationId): Promise<void>;
  saveDraftVersion(): Promise<void>;
  rollbackVersion(versionId: string): Promise<void>;
};

export type ResumeStore = ResumeStoreState & ResumeStoreActions;

function createEmptyResumeJson(): ResumeJson {
  return {
    basicInfo: {},
    lastUpdatedAt: new Date().toISOString(),
    version: 1,
  };
}

function parseResumeJsonFromEditor(raw: string): ResumeJson {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('编辑器内容为空');
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('编辑器内容不是 JSON 对象');
  }

  const record = parsed as Record<string, unknown>;
  if (record.version !== 1 || typeof record.basicInfo !== 'object') {
    throw new Error('resume 格式不正确：缺少 version=1 或 basicInfo');
  }

  return {
    ...(parsed as ResumeJson),
    lastUpdatedAt: new Date().toISOString(),
  } satisfies ResumeJson;
}

function replaceResumeInList(list: ResumeMeta[], resume: ResumeMeta): ResumeMeta[] {
  const without = list.filter((item) => item.id !== resume.id);
  return [resume, ...without].sort((a, b) => {
    const byUpdatedAt = b.updatedAt.localeCompare(a.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;
    return b.id.localeCompare(a.id);
  });
}

export const useResumeStore = create<ResumeStore>((set, get) => ({
  resumes: [],
  activeResumeId: undefined,
  activeResume: undefined,
  current: null,
  currentVersionId: undefined,
  versions: [],
  retentionLimit: 10,

  isLoadingResumes: false,
  isLoadingActiveResume: false,
  isCreating: false,
  isGenerating: false,
  isSaving: false,
  isRollingBackVersionId: undefined,

  draftText: '',
  generatedPreview: null,
  lastGenerateSummary: undefined,
  errorMessage: undefined,

  clearError() {
    set({ errorMessage: undefined });
  },

  setDraftText(text: string) {
    set({ draftText: text });
  },

  resetDraftFromCurrent() {
    const resume = get().current ?? createEmptyResumeJson();
    set({ draftText: JSON.stringify(resume, null, 2) });
  },

  applyPreviewToDraft() {
    const preview = get().generatedPreview;
    if (!preview) return;
    set({ draftText: JSON.stringify(preview, null, 2) });
  },

  async loadResumes() {
    if (get().isLoadingResumes) return;
    set({ isLoadingResumes: true, errorMessage: undefined });

    try {
      const resumes = await listResumes();
      set({ resumes });

      const activeResumeId = get().activeResumeId;
      if (!activeResumeId && resumes.length > 0) {
        await get().setActiveResumeId(resumes[0]!.id);
      }
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '加载简历列表失败' });
    } finally {
      set({ isLoadingResumes: false });
    }
  },

  async setActiveResumeId(resumeId: string) {
    set({
      activeResumeId: resumeId,
      errorMessage: undefined,
      generatedPreview: null,
      lastGenerateSummary: undefined,
    });
    await get().loadActiveResume();
  },

  async loadActiveResume() {
    const resumeId = get().activeResumeId;
    if (!resumeId) return;
    if (get().isLoadingActiveResume) return;

    set({ isLoadingActiveResume: true, errorMessage: undefined });
    try {
      const response = await getResume(resumeId);
      set({
        activeResume: response.resume,
        current: response.current,
        currentVersionId: response.currentVersionId,
        retentionLimit: response.retentionLimit,
        versions: response.versions,
      });

      if (!get().draftText.trim()) {
        get().resetDraftFromCurrent();
      }
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '加载简历失败' });
    } finally {
      set({ isLoadingActiveResume: false });
    }
  },

  async createNewResume(title?: string) {
    if (get().isCreating) return;
    set({ isCreating: true, errorMessage: undefined });

    try {
      const created = await createResume({ ...(title?.trim() ? { title: title.trim() } : {}) });
      set((state) => ({
        resumes: replaceResumeInList(state.resumes, created.resume),
      }));

      set({ draftText: '' });
      await get().setActiveResumeId(created.resume.id);
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '创建简历失败' });
    } finally {
      set({ isCreating: false });
    }
  },

  async renameActiveResume(title: string) {
    const resumeId = get().activeResumeId;
    if (!resumeId) return;

    const trimmed = title.trim();
    if (!trimmed) {
      set({ errorMessage: '标题不能为空' });
      return;
    }

    set({ errorMessage: undefined });
    try {
      const updated = await renameResume(resumeId, trimmed);
      set((state) => ({
        activeResume: updated,
        resumes: replaceResumeInList(state.resumes, updated),
      }));
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '重命名失败' });
    }
  },

  async deleteActiveResume() {
    const resumeId = get().activeResumeId;
    if (!resumeId) return;

    set({ errorMessage: undefined });
    try {
      await deleteResume(resumeId);

      set((state) => {
        const remaining = state.resumes.filter((item) => item.id !== resumeId);
        const nextActiveResumeId = remaining[0]?.id;
        return {
          activeResume: undefined,
          activeResumeId: nextActiveResumeId,
          current: null,
          currentVersionId: undefined,
          draftText: '',
          generatedPreview: null,
          lastGenerateSummary: undefined,
          resumes: remaining,
          versions: [],
        };
      });

      await get().loadActiveResume();
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '删除失败' });
    }
  },

  async generateAndSave(conversationId?: ConversationId) {
    if (get().isGenerating) return;
    set({ isGenerating: true, errorMessage: undefined, lastGenerateSummary: undefined });

    try {
      const response = await generateResume({
        ...(conversationId ? { conversationId } : {}),
      });

      set({
        generatedPreview: response.resume,
        lastGenerateSummary: {
          usedMemoryEntries: response.usedMemoryEntries,
          usedMessages: response.usedMessages,
        },
      });

      set((state) => ({
        resumes: replaceResumeInList(state.resumes, response.saved.resume),
      }));

      if (get().activeResumeId !== response.saved.resume.id) {
        await get().setActiveResumeId(response.saved.resume.id);
      } else {
        await get().loadActiveResume();
      }
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '生成简历失败' });
    } finally {
      set({ isGenerating: false });
    }
  },

  async saveDraftVersion() {
    const resumeId = get().activeResumeId;
    if (!resumeId) {
      set({ errorMessage: '未选择简历' });
      return;
    }

    if (get().isSaving) return;
    set({ isSaving: true, errorMessage: undefined });

    try {
      const resume = parseResumeJsonFromEditor(get().draftText);
      await saveResumeVersion(resumeId, resume);
      await get().loadActiveResume();
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '保存失败' });
    } finally {
      set({ isSaving: false });
    }
  },

  async rollbackVersion(versionId: string) {
    const resumeId = get().activeResumeId;
    if (!resumeId) {
      set({ errorMessage: '未选择简历' });
      return;
    }

    if (get().isRollingBackVersionId) return;
    set({ isRollingBackVersionId: versionId, errorMessage: undefined });

    try {
      await rollbackResumeVersion(resumeId, versionId);
      await get().loadActiveResume();
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '回滚失败' });
    } finally {
      set({ isRollingBackVersionId: undefined });
    }
  },
}));
