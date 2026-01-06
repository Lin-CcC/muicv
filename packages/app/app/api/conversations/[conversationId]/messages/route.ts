import type { ChatMessage } from '@muicv/shared';
import { getChatStore } from '@/src/server/chat-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ConversationMessagesRouteContext = {
  params: Promise<{ conversationId: string }>;
};

export async function GET(_request: Request, context: ConversationMessagesRouteContext) {
  const { conversationId } = await context.params;
  const conversation = await getChatStore().getConversation(conversationId);
  if (!conversation) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  const messages = await getChatStore().listMessages(conversationId);
  return Response.json(messages);
}

type AddMessageBody = {
  role?: ChatMessage['role'];
  content?: string;
};

export async function POST(request: Request, context: ConversationMessagesRouteContext) {
  const { conversationId } = await context.params;
  const conversation = await getChatStore().getConversation(conversationId);
  if (!conversation) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as AddMessageBody;
  const role = body.role ?? 'user';
  const content = body.content?.trim() ?? '';
  if (!content) {
    return Response.json({ message: 'content 不能为空' }, { status: 400 });
  }

  const message = await getChatStore().addMessage({
    conversationId,
    role,
    content,
  });

  return Response.json(message, { status: 201 });
}
