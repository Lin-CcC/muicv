import type { Conversation } from '@muicv/shared';
import { getChatStore } from '@/src/server/chat-store';
import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type ConversationRouteContext = {
  params: Promise<{ conversationId: string }>;
};

export async function GET(_request: Request, context: ConversationRouteContext) {
  const { conversationId } = await context.params;
  const store = await getChatStore();
  const conversation = await store.getConversation(conversationId);
  if (!conversation || conversation.userId !== DEMO_USER_ID) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  return Response.json(conversation);
}

type PatchConversationBody = {
  title?: string;
  contextResumeId?: string | null;
};

export async function PATCH(request: Request, context: ConversationRouteContext) {
  const { conversationId } = await context.params;
  const store = await getChatStore();
  const conversation = await store.getConversation(conversationId);
  if (!conversation || conversation.userId !== DEMO_USER_ID) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchConversationBody;

  const shouldPatchTitle = body.title !== undefined;
  const shouldPatchContext = Object.prototype.hasOwnProperty.call(body, 'contextResumeId');

  if (!shouldPatchTitle && !shouldPatchContext) {
    return Response.json({ message: '缺少可更新字段' }, { status: 400 });
  }

  let updated: Conversation = conversation;

  if (shouldPatchTitle) {
    const title = body.title?.trim() ?? '';
    if (!title) {
      return Response.json({ message: 'title 不能为空' }, { status: 400 });
    }

    updated = await store.renameConversation(conversationId, title);
  }

  if (shouldPatchContext) {
    const raw = body.contextResumeId;
    const contextResumeId = raw === null ? null : raw?.trim() ? raw.trim() : null;

    if (contextResumeId) {
      const resumeStore = await getResumeStore();
      const resume = await resumeStore.getResume(DEMO_USER_ID, contextResumeId);
      if (!resume) {
        return Response.json({ message: '要关联的简历不存在' }, { status: 404 });
      }
    }

    updated = await store.setConversationResumeContext(conversationId, contextResumeId);
  }

  return Response.json(updated);
}

export async function DELETE(_request: Request, context: ConversationRouteContext) {
  const { conversationId } = await context.params;
  const store = await getChatStore();
  const conversation = await store.getConversation(conversationId);
  if (!conversation || conversation.userId !== DEMO_USER_ID) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  await store.deleteConversation(conversationId);
  return Response.json({ ok: true });
}
