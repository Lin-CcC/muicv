import assert from 'node:assert/strict';
import test from 'node:test';

import { DatabaseSync } from 'node:sqlite';

import type { ResumeJson } from '@muicv/shared';

import { applySqliteMigrations } from './db/sqlite-migrations.ts';
import { getDefaultMigrationsDirectoryPath } from './db/sqlite-database.ts';
import { createSqliteResumeStore } from './sqlite-resume-store.ts';

function createResumeJson(summary: string): ResumeJson {
  return {
    basicInfo: { fullName: '测试用户' },
    lastUpdatedAt: new Date().toISOString(),
    summary,
    version: 1,
  };
}

function countSnapshots(database: DatabaseSync, userId: string) {
  const row = database
    .prepare('SELECT COUNT(1) AS count FROM resume_snapshots WHERE user_id = ?')
    .get(userId) as unknown as { count: number } | undefined;
  return Number(row?.count ?? 0);
}

test('sqlite resume store：按保留数量裁剪旧版本', async () => {
  const oldLimit = process.env.MUICV_RESUME_SNAPSHOT_LIMIT;
  process.env.MUICV_RESUME_SNAPSHOT_LIMIT = '3';

  try {
    const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
    applySqliteMigrations({
      database,
      migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
    });

    const store = createSqliteResumeStore({ database });

    await store.saveResumeSnapshot({ resume: createResumeJson('v1'), userId: 'u1' });
    await store.saveResumeSnapshot({ resume: createResumeJson('v2'), userId: 'u1' });
    await store.saveResumeSnapshot({ resume: createResumeJson('v3'), userId: 'u1' });
    await store.saveResumeSnapshot({ resume: createResumeJson('v4'), userId: 'u1' });

    const snapshots = await store.listResumeSnapshots('u1');
    assert.equal(snapshots.length, 3);
    assert.equal(countSnapshots(database, 'u1'), 3);

    const current = await store.getCurrentResume('u1');
    assert.ok(current);
    assert.equal(current.resume.summary, 'v4');
  } finally {
    if (oldLimit === undefined) {
      delete process.env.MUICV_RESUME_SNAPSHOT_LIMIT;
    } else {
      process.env.MUICV_RESUME_SNAPSHOT_LIMIT = oldLimit;
    }
  }
});

test('sqlite resume store：可回滚到历史版本并生成新版本', async () => {
  const oldLimit = process.env.MUICV_RESUME_SNAPSHOT_LIMIT;
  process.env.MUICV_RESUME_SNAPSHOT_LIMIT = '3';

  try {
    const database = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
    applySqliteMigrations({
      database,
      migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
    });

    const store = createSqliteResumeStore({ database });

    const s1 = await store.saveResumeSnapshot({ resume: createResumeJson('v1'), userId: 'u1' });
    const s2 = await store.saveResumeSnapshot({ resume: createResumeJson('v2'), userId: 'u1' });
    const s3 = await store.saveResumeSnapshot({ resume: createResumeJson('v3'), userId: 'u1' });

    const beforeRollback = await store.getCurrentResume('u1');
    assert.ok(beforeRollback);
    assert.equal(beforeRollback.resume.summary, 'v3');

    const rollbackSnapshot = await store.rollbackResumeSnapshot('u1', s1.id);
    assert.notEqual(rollbackSnapshot.id, s1.id);

    const afterRollback = await store.getCurrentResume('u1');
    assert.ok(afterRollback);
    assert.equal(afterRollback.resume.summary, 'v1');

    const snapshots = await store.listResumeSnapshots('u1');
    assert.equal(snapshots.length, 3);
    assert.equal(countSnapshots(database, 'u1'), 3);

    const snapshotIds = snapshots.map((snapshot) => snapshot.id);
    assert.equal(snapshotIds[0], rollbackSnapshot.id);
    assert.deepEqual(new Set(snapshotIds), new Set([rollbackSnapshot.id, s3.id, s2.id]));
  } finally {
    if (oldLimit === undefined) {
      delete process.env.MUICV_RESUME_SNAPSHOT_LIMIT;
    } else {
      process.env.MUICV_RESUME_SNAPSHOT_LIMIT = oldLimit;
    }
  }
});
