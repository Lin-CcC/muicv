import assert from 'node:assert/strict';
import test from 'node:test';

import { DatabaseSync } from 'node:sqlite';

import { applySqliteMigrations } from './db/sqlite-migrations.ts';
import { getDefaultMigrationsDirectoryPath } from './db/sqlite-database.ts';
import { createSqliteChatStore } from './sqlite-chat-store.ts';
import { createSqliteMemoryStore } from './sqlite-memory-store.ts';

test('sqlite memory store：可写入并按时间倒序列出', async () => {
  const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  applySqliteMigrations({
    database,
    migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
  });

  const store = createSqliteMemoryStore({ database });

  const first = await store.addMemoryEntry({
    kind: 'skill',
    title: '开始使用 Vue',
    userId: 'u1',
  });

  const second = await store.addMemoryEntry({
    kind: 'career_event',
    title: '入职创业公司',
    userId: 'u1',
  });

  const list = await store.listMemoryEntries('u1', { limit: 10 });
  assert.equal(list.length, 2);
  assert.equal(list[0]!.id, second.id);
  assert.equal(list[1]!.id, first.id);
});

test('sqlite memory store：支持按对话过滤与清理引用', async () => {
  const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  applySqliteMigrations({
    database,
    migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
  });

  const chatStore = createSqliteChatStore({ database });
  const store = createSqliteMemoryStore({ database });

  const conversation = await chatStore.createConversation({ userId: 'u1' });
  const message = await chatStore.addMessage({
    content: '我这个月开始接触 Vue 开发',
    conversationId: conversation.id,
    role: 'user',
  });

  const entry = await store.addMemoryEntry({
    conversationId: conversation.id,
    kind: 'skill',
    messageId: message.id,
    tags: ['Vue'],
    title: '开始接触 Vue 开发',
    userId: 'u1',
  });

  const before = await store.listMemoryEntries('u1', { conversationId: conversation.id });
  assert.equal(before.length, 1);
  assert.equal(before[0]!.id, entry.id);

  await store.clearConversationReferences(conversation.id);

  const after = await store.listMemoryEntries('u1', { conversationId: conversation.id });
  assert.equal(after.length, 0);

  const all = await store.listMemoryEntries('u1');
  assert.equal(all.length, 1);
  assert.equal(all[0]!.conversationId, null);
});
