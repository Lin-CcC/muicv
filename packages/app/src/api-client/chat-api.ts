import type { ChatMessage, Conversation, ConversationId } from '@muicv/shared';

import { fetchJson } from './fetch-json';

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

export async function listMessages(conversationId: ConversationId): Promise<ChatMessage[]> {
  return fetchJson<ChatMessage[]>(`/api/conversations/${conversationId}/messages`, { method: 'GET' });
}

export async function addMessage(
  conversationId: ConversationId,
  params: { role: ChatMessage['role']; content: string },
): Promise<{ messages: ChatMessage[]; assistantError?: string; resumeUpdated?: boolean; resumeSnapshotId?: string }> {
  return fetchJson<{
    messages: ChatMessage[];
    assistantError?: string;
    resumeUpdated?: boolean;
    resumeSnapshotId?: string;
  }>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
