import type { ChatMessage, Conversation, ConversationId } from '@muicv/shared';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`响应不是 JSON（status=${response.status}）`);
  }

  return (await response.json()) as T;
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await readJson<JsonValue>(response).catch(() => null);
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `请求失败（status=${response.status}）`;
    throw new Error(message);
  }

  return readJson<T>(response);
}

export async function listConversations(): Promise<Conversation[]> {
  return fetchJson<Conversation[]>('/api/conversations', { method: 'GET' });
}

export async function createConversation(title?: string): Promise<Conversation> {
  return fetchJson<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(title === undefined ? {} : { title }),
  });
}

export async function listMessages(conversationId: ConversationId): Promise<ChatMessage[]> {
  return fetchJson<ChatMessage[]>(`/api/conversations/${conversationId}/messages`, { method: 'GET' });
}

export async function addMessage(
  conversationId: ConversationId,
  params: { role: ChatMessage['role']; content: string },
): Promise<ChatMessage> {
  return fetchJson<ChatMessage>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
