import type { ChatMessage } from '@muicv/shared';
import { getChatStore } from '@/src/server/chat-store';
import type { AiProviderId } from '@/src/server/ai/ai-service';
import { buildAiMessagesForAssistant, getAiClient } from '@/src/server/ai/ai-service';
import { getDefaultChatSystemPrompt } from '@/src/server/ai/system-prompts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ConversationMessagesRouteContext = {
  params: Promise<{ conversationId: string }>;
};

export async function GET(_request: Request, context: ConversationMessagesRouteContext) {
  const { conversationId } = await context.params;
  const store = await getChatStore();
  const conversation = await store.getConversation(conversationId);
  if (!conversation) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  const messages = await store.listMessages(conversationId);
  return Response.json(messages);
}

type AddMessageBody = {
  role?: ChatMessage['role'];
  content?: string;
  provider?: AiProviderId;
  model?: string;
};

export async function POST(request: Request, context: ConversationMessagesRouteContext) {
  console.log('xxx', process.env.GOOGLE_API_KEY);
  console.log('xxx1', process.env.OPENAI_API_KEY);
  const { conversationId } = await context.params;
  const store = await getChatStore();
  const conversation = await store.getConversation(conversationId);
  if (!conversation) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as AddMessageBody;
  const role = body.role ?? 'user';
  const content = body.content?.trim() ?? '';
  if (!content) {
    return Response.json({ message: 'content 不能为空' }, { status: 400 });
  }

  const createdMessages: ChatMessage[] = [];

  const userMessage = await store.addMessage({
    conversationId,
    role,
    content,
  });

  createdMessages.push(userMessage);

  let assistantError: string | undefined;

  if (role === 'user') {
    try {
      const history = await store.listMessages(conversationId);
      const aiMessages = buildAiMessagesForAssistant({
        messages: history,
        systemPrompt: getDefaultChatSystemPrompt(),
      });

      const client = getAiClient({
        ...(body.model?.trim() ? { model: body.model.trim() } : {}),
        ...(body.provider ? { provider: body.provider } : {}),
      });
      const result = await client.provider.generateText({
        maxOutputTokens: 800,
        messages: aiMessages,
        model: client.model,
        temperature: 0.3,
      });

      const assistantText = result.text.trim();
      if (assistantText) {
        const assistantMessage = await store.addMessage({
          content: assistantText,
          conversationId,
          role: 'assistant',
        });
        createdMessages.push(assistantMessage);
      }
    } catch (error) {
      assistantError = error instanceof Error ? error.message : 'AI 生成失败';
    }
  }

  return Response.json({ messages: createdMessages, assistantError }, { status: 201 });
}
