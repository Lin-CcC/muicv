import assert from 'node:assert/strict';
import test from 'node:test';

import { DatabaseSync } from 'node:sqlite';

import { applySqliteMigrations } from './db/sqlite-migrations.ts';
import { getDefaultMigrationsDirectoryPath } from './db/sqlite-database.ts';
import { createSqliteChatStore } from './sqlite-chat-store.ts';

test('sqlite store：可创建对话与追加消息', async () => {
  const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  applySqliteMigrations({
    database,
    migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
  });

  const store = createSqliteChatStore({ database });

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

test('sqlite store：对话列表按 updatedAt 倒序，追加消息会更新 updatedAt', async () => {
  const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  applySqliteMigrations({
    database,
    migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
  });

  const store = createSqliteChatStore({ database });

  const first = await store.createConversation({ userId: 'u1', title: '先创建' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await store.createConversation({ userId: 'u1', title: '后创建' });

  const list1 = await store.listConversations('u1');
  assert.equal(list1.length, 2);
  assert.equal(list1[0]?.id, second.id);
  assert.equal(list1[1]?.id, first.id);

  await new Promise((resolve) => setTimeout(resolve, 5));
  await store.addMessage({ conversationId: first.id, role: 'user', content: '把我顶上去' });

  const list2 = await store.listConversations('u1');
  assert.equal(list2.length, 2);
  assert.equal(list2[0]?.id, first.id);
  assert.equal(list2[1]?.id, second.id);
});
