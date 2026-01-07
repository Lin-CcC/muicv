import type { ChatMessage, ResumeJson } from '@muicv/shared';

import type { AiProviderId } from '@/src/server/ai/ai-service';
import { generateResumeJson } from '@/src/server/ai/resume-generator';
import { getChatStore } from '@/src/server/chat-store';
import { getMemoryStore } from '@/src/server/memory-store';
import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type GenerateResumeBody = {
  conversationId?: string;
  title?: string;
  provider?: AiProviderId;
  model?: string;
  memoryLimit?: number;
  messageLimit?: number;
};

type GenerateResumeResponse = {
  resume: ResumeJson;
  usedMemoryEntries: number;
  usedMessages: number;
  saved: {
    wasCreated: boolean;
    resume: {
      id: string;
      userId: string;
      title: string;
      sourceConversationId: string | null;
      createdAt: string;
      updatedAt: string;
    };
    version: {
      id: string;
      resumeId: string;
      userId: string;
      createdAt: string;
    };
  };
};

function normalizeLimit(value: number | undefined, fallback: number, max: number) {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  if (normalized <= 0) return fallback;
  return Math.min(max, normalized);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as GenerateResumeBody;
    const conversationId = body.conversationId?.trim();
    const memoryLimit = normalizeLimit(body.memoryLimit, 80, 200);
    const messageLimit = normalizeLimit(body.messageLimit, 24, 60);

    const memoryStore = await getMemoryStore();
    const memoryEntries = await memoryStore.listMemoryEntries(DEMO_USER_ID, { limit: memoryLimit });

    let messages: ChatMessage[] = [];
    let conversationTitle = '';
    let existingContextResumeId: string | null = null;

    if (conversationId) {
      const chatStore = await getChatStore();
      const conversation = await chatStore.getConversation(conversationId);
      if (!conversation) {
        return Response.json({ message: '对话不存在' }, { status: 404 });
      }

      if (conversation.userId !== DEMO_USER_ID) {
        return Response.json({ message: '对话不存在' }, { status: 404 });
      }

      conversationTitle = conversation.title;
      existingContextResumeId = conversation.contextResumeId;
      messages = await chatStore.listMessages(conversationId);
    }

    if (memoryEntries.length === 0 && messages.length === 0) {
      return Response.json({ message: '没有可用于生成简历的记录，请先在对话中补充信息。' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const result = await generateResumeJson({
      memoryEntries,
      maxMemoryEntries: memoryLimit,
      maxMessages: messageLimit,
      messages,
      nowIso,
      ...(conversationId ? { conversationId } : {}),
      ...(body.provider ? { provider: body.provider } : {}),
      ...(body.model?.trim() ? { model: body.model.trim() } : {}),
    });

    const resumeStore = await getResumeStore();
    const desiredTitle = body.title?.trim()
      ? body.title.trim()
      : conversationTitle.trim()
        ? `${conversationTitle} 简历`
        : undefined;

    let saved:
      | {
          wasCreated: boolean;
          resume: {
            id: string;
            userId: string;
            title: string;
            sourceConversationId: string | null;
            createdAt: string;
            updatedAt: string;
          };
          version: {
            id: string;
            resumeId: string;
            userId: string;
            createdAt: string;
          };
        }
      | undefined;

    if (conversationId) {
      const chatStore = await getChatStore();

      const resumeId = existingContextResumeId?.trim() ? existingContextResumeId.trim() : null;
      if (resumeId) {
        const existingResume = await resumeStore.getResume(DEMO_USER_ID, resumeId);
        if (existingResume) {
          const version = await resumeStore.saveResumeVersion({
            resume: result.resume,
            resumeId,
            userId: DEMO_USER_ID,
          });

          const updatedResume = await resumeStore.getResume(DEMO_USER_ID, resumeId);
          if (!updatedResume) {
            throw new Error('简历保存成功，但读取失败');
          }

          saved = {
            resume: updatedResume,
            version,
            wasCreated: false,
          };
        }
      }

      if (!saved) {
        const created = await resumeStore.createResumeWithVersion({
          resume: result.resume,
          userId: DEMO_USER_ID,
          ...(desiredTitle ? { title: desiredTitle } : {}),
          sourceConversationId: conversationId,
        });

        await chatStore.setConversationResumeContext(conversationId, created.resume.id);

        saved = {
          resume: created.resume,
          version: created.version,
          wasCreated: true,
        };
      }
    } else {
      const created = await resumeStore.createResumeWithVersion({
        resume: result.resume,
        userId: DEMO_USER_ID,
        ...(desiredTitle ? { title: desiredTitle } : {}),
      });

      saved = {
        resume: created.resume,
        version: created.version,
        wasCreated: true,
      };
    }

    const response: GenerateResumeResponse = {
      resume: result.resume,
      usedMemoryEntries: result.usedMemoryEntries,
      usedMessages: result.usedMessages,
      saved,
    };
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成简历失败';
    return Response.json({ message }, { status: 500 });
  }
}
