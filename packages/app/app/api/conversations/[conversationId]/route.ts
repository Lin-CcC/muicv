import type { Conversation } from '@muicv/shared';
import { getChatStore } from '@/src/server/chat-store';

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
};

export async function PATCH(request: Request, context: ConversationRouteContext) {
  const { conversationId } = await context.params;
  const store = await getChatStore();
  const conversation = await store.getConversation(conversationId);
  if (!conversation || conversation.userId !== DEMO_USER_ID) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchConversationBody;
  const title = body.title?.trim() ?? '';
  if (!title) {
    return Response.json({ message: 'title 不能为空' }, { status: 400 });
  }

  const updated: Conversation = await store.renameConversation(conversationId, title);
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
