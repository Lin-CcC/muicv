import type { AiUsage, ChatMessage, MemoryEntry } from '@muicv/shared';

import type { AiProviderId } from '@/src/server/ai/ai-service';
import { buildAiMessagesForAssistant, getAiClient } from '@/src/server/ai/ai-service';
import type { ChatContextResume } from '@/src/server/ai/chat-context';
import { buildChatSystemPrompt } from '@/src/server/ai/chat-context';
import { extractMemoryEntries } from '@/src/server/ai/memory-extractor';
import { getDefaultChatSystemPrompt } from '@/src/server/ai/system-prompts';
import { getChatStore } from '@/src/server/chat-store';
import { shouldAttemptMemoryExtraction } from '@/src/server/memory-extraction-heuristics';
import { getMemoryStore } from '@/src/server/memory-store';
import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type ConversationMessagesStreamRouteContext = {
  params: Promise<{ conversationId: string }>;
};

type StreamMessageBody = {
  content?: string;
  provider?: AiProviderId;
  model?: string;
};

type StreamDonePayload = {
  assistantMessage: ChatMessage | null;
  usage?: AiUsage;
};

function encodeSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request, context: ConversationMessagesStreamRouteContext) {
  const { conversationId } = await context.params;
  const store = await getChatStore();

  const conversation = await store.getConversation(conversationId);
  if (!conversation || conversation.userId !== DEMO_USER_ID) {
    return Response.json({ message: '对话不存在' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as StreamMessageBody;
  const content = body.content?.trim() ?? '';
  if (!content) {
    return Response.json({ message: 'content 不能为空' }, { status: 400 });
  }

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
        const userMessage = await store.addMessage({
          conversationId,
          content,
          role: 'user',
        });

        tryEnqueue('user', userMessage);

        const history = await store.listMessages(conversationId);

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

        const donePayload: StreamDonePayload = {
          assistantMessage,
          ...(usage ? { usage } : {}),
        };

        tryEnqueue('done', donePayload);

        if (shouldAttemptMemoryExtraction(content)) {
          try {
            const extractionHistory = await store.listMessages(conversationId);
            const extraction = await extractMemoryEntries({
              messages: extractionHistory,
              nowIso: new Date().toISOString(),
              ...(body.model?.trim() ? { model: body.model.trim() } : {}),
              ...(body.provider ? { provider: body.provider } : {}),
            });

            if (extraction.shouldWriteMemory && extraction.entries.length > 0) {
              const memoryStore = await getMemoryStore();
              await memoryStore.addMemoryEntries(
                extraction.entries.map((entry) => ({
                  ...entry,
                  conversationId,
                  messageId: userMessage.id,
                  userId: DEMO_USER_ID,
                })),
              );
            }
          } catch {
            // 记忆抽取失败不应影响对话主流程；后续接入日志/监控再补齐可观测性。
          }
        }
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
