import type { ChatMessage } from '@muicv/shared';
import { getChatStore } from '@/src/server/chat-store';
import type { AiProviderId } from '@/src/server/ai/ai-service';
import { buildAiMessagesForAssistant, getAiClient } from '@/src/server/ai/ai-service';
import { extractResumeUpdate } from '@/src/server/ai/resume-extractor';
import { getDefaultChatSystemPrompt } from '@/src/server/ai/system-prompts';
import { createMonotonicIsoTimestamp } from '@/src/server/monotonic-time';
import { shouldAttemptResumeExtraction } from '@/src/server/resume-extraction-heuristics';
import { getResumeStore } from '@/src/server/resume-store';
import { isResumeMeaningfullyDifferent } from '@/src/server/resume-versioning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

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
  let resumeUpdated = false;
  let resumeSnapshotId: string | undefined;

  if (role === 'user') {
    const history = await store.listMessages(conversationId);
    try {
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

    if (shouldAttemptResumeExtraction(content)) {
      try {
        const resumeStore = await getResumeStore();
        const currentSnapshot = await resumeStore.getCurrentResume(DEMO_USER_ID);
        const currentResume = currentSnapshot?.resume ?? null;

        const extraction = await extractResumeUpdate({
          currentResume,
          messages: history,
          ...(body.model?.trim() ? { model: body.model.trim() } : {}),
          ...(body.provider ? { provider: body.provider } : {}),
        });

        if (extraction.shouldUpdateResume && extraction.updatedResume) {
          const resumeToSave = {
            ...extraction.updatedResume,
            lastUpdatedAt: createMonotonicIsoTimestamp(),
          };

          if (isResumeMeaningfullyDifferent(currentResume, resumeToSave)) {
            const snapshot = await resumeStore.saveResumeSnapshot({
              conversationId,
              resume: resumeToSave,
              userId: DEMO_USER_ID,
            });
            resumeUpdated = true;
            resumeSnapshotId = snapshot.id;
          }
        }
      } catch {
        // 简历抽取失败不应影响对话主流程；后续接入日志/监控再补齐可观测性。
      }
    }
  }

  return Response.json(
    {
      assistantError,
      messages: createdMessages,
      ...(resumeUpdated ? { resumeSnapshotId, resumeUpdated } : { resumeUpdated }),
    },
    { status: 201 },
  );
}
