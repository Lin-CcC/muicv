import type { AiUsage, ChatMessage, Conversation, ConversationId } from '@muicv/shared';

import { fetchJson } from './fetch-json';
import { iterateSseEvents } from './sse';

export async function listConversations(): Promise<Conversation[]> {
  return fetchJson<Conversation[]>('/api/conversations', { method: 'GET' });
}

export async function createConversation(title?: string): Promise<Conversation> {
  return fetchJson<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(title === undefined ? {} : { title }),
  });
}

export async function renameConversation(conversationId: ConversationId, title: string): Promise<Conversation> {
  return fetchJson<Conversation>(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(conversationId: ConversationId): Promise<void> {
  await fetchJson<{ ok: true }>(`/api/conversations/${conversationId}`, { method: 'DELETE' });
}

export async function setConversationResumeContext(
  conversationId: ConversationId,
  resumeId: string | null,
): Promise<Conversation> {
  return fetchJson<Conversation>(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ contextResumeId: resumeId }),
  });
}

export async function listMessages(conversationId: ConversationId): Promise<ChatMessage[]> {
  return fetchJson<ChatMessage[]>(`/api/conversations/${conversationId}/messages`, { method: 'GET' });
}

export async function addMessage(
  conversationId: ConversationId,
  params: { role: ChatMessage['role']; content: string },
): Promise<{ messages: ChatMessage[]; assistantError?: string }> {
  return fetchJson<{
    messages: ChatMessage[];
    assistantError?: string;
  }>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export type ChatStreamEvent =
  | {
      type: 'user';
      message: ChatMessage;
    }
  | {
      type: 'delta';
      textDelta: string;
    }
  | {
      type: 'done';
      assistantMessage: ChatMessage | null;
      usage?: AiUsage;
    }
  | {
      type: 'error';
      message: string;
    };

export type AiProviderId = 'openai' | 'gemini';

export async function* streamUserMessage(
  conversationId: ConversationId,
  params: { content: string; provider?: AiProviderId; model?: string; signal?: AbortSignal },
): AsyncIterable<ChatStreamEvent> {
  const response = await fetch(`/api/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: params.content,
      ...(params.provider ? { provider: params.provider } : {}),
      ...(params.model ? { model: params.model } : {}),
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    try {
      const json = JSON.parse(text) as { message?: string };
      throw new Error(json.message?.trim() ? json.message.trim() : '发送失败');
    } catch {
      throw new Error(text.trim() ? text.trim() : '发送失败');
    }
  }

  for await (const event of iterateSseEvents(response)) {
    if (event.event === 'user') {
      yield { message: JSON.parse(event.data) as ChatMessage, type: 'user' };
      continue;
    }

    if (event.event === 'delta') {
      const payload = JSON.parse(event.data) as { textDelta?: string };
      if (payload.textDelta) {
        yield { textDelta: payload.textDelta, type: 'delta' };
      }
      continue;
    }

    if (event.event === 'done') {
      const payload = JSON.parse(event.data) as { assistantMessage: ChatMessage | null; usage?: AiUsage };
      yield { type: 'done', ...payload };
      continue;
    }

    if (event.event === 'error') {
      const payload = JSON.parse(event.data) as { message?: string };
      yield { message: payload.message?.trim() ? payload.message.trim() : 'AI 生成失败', type: 'error' };
      continue;
    }
  }
}

export async function* streamRetryAssistant(
  conversationId: ConversationId,
  params?: { provider?: AiProviderId; model?: string; signal?: AbortSignal },
): AsyncIterable<ChatStreamEvent> {
  const response = await fetch(`/api/conversations/${conversationId}/messages/retry`, {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...(params?.provider ? { provider: params.provider } : {}),
      ...(params?.model ? { model: params.model } : {}),
    }),
    signal: params?.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    try {
      const json = JSON.parse(text) as { message?: string };
      throw new Error(json.message?.trim() ? json.message.trim() : '重试失败');
    } catch {
      throw new Error(text.trim() ? text.trim() : '重试失败');
    }
  }

  for await (const event of iterateSseEvents(response)) {
    if (event.event === 'delta') {
      const payload = JSON.parse(event.data) as { textDelta?: string };
      if (payload.textDelta) {
        yield { textDelta: payload.textDelta, type: 'delta' };
      }
      continue;
    }

    if (event.event === 'done') {
      const payload = JSON.parse(event.data) as { assistantMessage: ChatMessage | null; usage?: AiUsage };
      yield { type: 'done', ...payload };
      continue;
    }

    if (event.event === 'error') {
      const payload = JSON.parse(event.data) as { message?: string };
      yield { message: payload.message?.trim() ? payload.message.trim() : 'AI 生成失败', type: 'error' };
      continue;
    }
  }
}
