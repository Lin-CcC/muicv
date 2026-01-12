import type { AiUsage, ChatMessage, MemoryEntry } from '@muicv/shared';

import type { AiProviderId } from '@/src/server/ai/ai-service';
import { buildAiMessagesForAssistant, getAiClient } from '@/src/server/ai/ai-service';
import type { ChatContextResume } from '@/src/server/ai/chat-context';
import { buildChatSystemPrompt } from '@/src/server/ai/chat-context';
import { getDefaultChatSystemPrompt } from '@/src/server/ai/system-prompts';
import { getChatStore } from '@/src/server/chat-store';
import { getMemoryStore } from '@/src/server/memory-store';
import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type ConversationMessagesRetryRouteContext = {
  params: Promise<{ conversationId: string }>;
};

type RetryBody = {
  provider?: AiProviderId;
  model?: string;
};

type RetryDonePayload = {
  assistantMessage: ChatMessage | null;
  usage?: AiUsage;
};

function encodeSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request, context: ConversationMessagesRetryRouteContext) {
  const { conversationId } = await context.params;
  const store = await getChatStore();

  const conversation = await store.getConversation(conversationId);
  if (!conversation || conversation.userId !== DEMO_USER_ID) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as RetryBody;

  const encoder = new TextEncoder();
  const generationAbortController = new AbortController();

  function abortGeneration() {
    if (generationAbortController.signal.aborted) return;
    generationAbortController.abort();
  }

  const requestAbortHandler = () => abortGeneration();
  request.signal.addEventListener('abort', requestAbortHandler);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function tryEnqueue(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
        } catch {
          // 如果客户端中途断开，enqueue 可能失败；此时静默忽略即可。
        }
      }

      let assistantMessage: ChatMessage | null = null;
      let assistantText = '';
      let usage: AiUsage | undefined;

      try {
        const history = await store.listMessages(conversationId);
        if (history.length === 0) {
          tryEnqueue('error', { message: '没有可重试的消息' });
          try {
            controller.close();
          } catch {
            // ignore
          }
          return;
        }

        let memoryEntries: MemoryEntry[] = [];
        try {
          const memoryStore = await getMemoryStore();
          memoryEntries = await memoryStore.listMemoryEntries(DEMO_USER_ID, { limit: 80 });
        } catch {
          memoryEntries = [];
        }

        let contextResume: ChatContextResume | undefined;
        const contextResumeId = conversation.contextResumeId?.trim();
        try {
          if (contextResumeId) {
            const resumeStore = await getResumeStore();
            const resumeMeta = await resumeStore.getResume(DEMO_USER_ID, contextResumeId);
            const resumeVersion = await resumeStore.getCurrentResumeVersion(DEMO_USER_ID, contextResumeId);
            if (resumeMeta && resumeVersion) {
              contextResume = {
                resume: resumeVersion.resume,
                title: resumeMeta.title,
              };
            }
          }
        } catch {
          contextResume = undefined;
        }

        const aiMessages = buildAiMessagesForAssistant({
          messages: history,
          systemPrompt: buildChatSystemPrompt({
            basePrompt: getDefaultChatSystemPrompt(),
            contextResume,
            memoryEntries,
          }),
        });

        const client = getAiClient({
          ...(body.model?.trim() ? { model: body.model.trim() } : {}),
          ...(body.provider ? { provider: body.provider } : {}),
        });

        for await (const event of client.provider.streamText({
          maxOutputTokens: 800,
          messages: aiMessages,
          model: client.model,
          temperature: 0.3,
          signal: generationAbortController.signal,
        })) {
          if (event.type === 'delta') {
            assistantText += event.textDelta;
            tryEnqueue('delta', { textDelta: event.textDelta });
          } else if (event.type === 'done') {
            usage = event.usage;
          }
        }

        const finalText = assistantText.trim();
        if (finalText) {
          assistantMessage = await store.addMessage({
            content: finalText,
            conversationId,
            role: 'assistant',
          });
        }

        const donePayload: RetryDonePayload = {
          assistantMessage,
          ...(usage ? { usage } : {}),
        };
        tryEnqueue('done', donePayload);
      } catch (error) {
        const finalText = assistantText.trim();
        if (!assistantMessage && finalText) {
          try {
            assistantMessage = await store.addMessage({
              content: finalText,
              conversationId,
              role: 'assistant',
            });
          } catch {
            // 忽略：错误时的兜底保存失败，不应覆盖原始错误。
          }
        }

        const message = error instanceof Error ? error.message : 'AI 生成失败';
        tryEnqueue('error', { message });
      } finally {
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
    cancel() {
      abortGeneration();
    },
  });

  const headers = new Headers();
  headers.set('content-type', 'text/event-stream; charset=utf-8');
  headers.set('cache-control', 'no-cache, no-transform');
  headers.set('connection', 'keep-alive');

  return new Response(stream, { headers });
}
