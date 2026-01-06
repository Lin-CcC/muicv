import assert from 'node:assert/strict';
import test from 'node:test';

import { createInMemoryChatStore } from './in-memory-chat-store.ts';

test('in-memory store：可创建对话与追加消息', async () => {
  const store = createInMemoryChatStore();

  const conversation = await store.createConversation({ userId: 'u1', title: '投递 A 公司' });
  assert.equal(conversation.userId, 'u1');
  assert.equal(conversation.title, '投递 A 公司');

  const message = await store.addMessage({
    conversationId: conversation.id,
    role: 'user',
    content: '你好，我想优化简历。',
  });

  assert.equal(message.conversationId, conversation.id);
  assert.equal(message.role, 'user');

  const messages = await store.listMessages(conversation.id);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.id, message.id);
});

test('in-memory store：对话列表按 updatedAt 倒序', async () => {
  const store = createInMemoryChatStore();

  const first = await store.createConversation({ userId: 'u1', title: '先创建' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await store.createConversation({ userId: 'u1', title: '后创建' });

  const list = await store.listConversations('u1');
  assert.equal(list.length, 2);
  assert.equal(list[0]?.id, second.id);
  assert.equal(list[1]?.id, first.id);
});

test('in-memory store：重命名会更新标题并把对话顶到最前', async () => {
  const store = createInMemoryChatStore();

  const first = await store.createConversation({ userId: 'u1', title: '先创建' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await store.createConversation({ userId: 'u1', title: '后创建' });

  const list1 = await store.listConversations('u1');
  assert.equal(list1[0]?.id, second.id);
  assert.equal(list1[1]?.id, first.id);

  await new Promise((resolve) => setTimeout(resolve, 5));
  const renamed = await store.renameConversation(first.id, '改名后');
  assert.equal(renamed.title, '改名后');

  const list2 = await store.listConversations('u1');
  assert.equal(list2[0]?.id, first.id);
  assert.equal(list2[0]?.title, '改名后');
});

test('in-memory store：删除对话会清理消息', async () => {
  const store = createInMemoryChatStore();

  const conversation = await store.createConversation({ userId: 'u1', title: '待删除' });
  await store.addMessage({ conversationId: conversation.id, role: 'user', content: 'hello' });

  await store.deleteConversation(conversation.id);

  const found = await store.getConversation(conversation.id);
  assert.equal(found, undefined);

  const list = await store.listConversations('u1');
  assert.equal(list.length, 0);

  const messages = await store.listMessages(conversation.id);
  assert.equal(messages.length, 0);
});
