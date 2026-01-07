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

function countVersions(database: DatabaseSync, userId: string, resumeId: string) {
  const row = database
    .prepare('SELECT COUNT(1) AS count FROM resume_versions WHERE user_id = ? AND resume_id = ?')
    .get(userId, resumeId) as unknown as { count: number } | undefined;
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

    const created = await store.createResumeWithVersion({
      resume: createResumeJson('v1'),
      title: '测试简历',
      userId: 'u1',
    });
    await store.saveResumeVersion({ resume: createResumeJson('v2'), resumeId: created.resume.id, userId: 'u1' });
    await store.saveResumeVersion({ resume: createResumeJson('v3'), resumeId: created.resume.id, userId: 'u1' });
    await store.saveResumeVersion({ resume: createResumeJson('v4'), resumeId: created.resume.id, userId: 'u1' });

    const versions = await store.listResumeVersions('u1', created.resume.id);
    assert.equal(versions.length, 3);
    assert.equal(countVersions(database, 'u1', created.resume.id), 3);

    const current = await store.getCurrentResumeVersion('u1', created.resume.id);
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

    const created = await store.createResumeWithVersion({
      resume: createResumeJson('v1'),
      title: '测试简历',
      userId: 'u1',
    });
    const v2 = await store.saveResumeVersion({
      resume: createResumeJson('v2'),
      resumeId: created.resume.id,
      userId: 'u1',
    });
    const v3 = await store.saveResumeVersion({
      resume: createResumeJson('v3'),
      resumeId: created.resume.id,
      userId: 'u1',
    });

    const beforeRollback = await store.getCurrentResumeVersion('u1', created.resume.id);
    assert.ok(beforeRollback);
    assert.equal(beforeRollback.resume.summary, 'v3');

    const rollbackVersion = await store.rollbackResumeVersion('u1', created.resume.id, created.version.id);
    assert.notEqual(rollbackVersion.id, created.version.id);

    const afterRollback = await store.getCurrentResumeVersion('u1', created.resume.id);
    assert.ok(afterRollback);
    assert.equal(afterRollback.resume.summary, 'v1');

    const versions = await store.listResumeVersions('u1', created.resume.id);
    assert.equal(versions.length, 3);
    assert.equal(countVersions(database, 'u1', created.resume.id), 3);

    const versionIds = versions.map((version) => version.id);
    assert.equal(versionIds[0], rollbackVersion.id);
    assert.deepEqual(new Set(versionIds), new Set([rollbackVersion.id, v3.id, v2.id]));
  } finally {
    if (oldLimit === undefined) {
      delete process.env.MUICV_RESUME_SNAPSHOT_LIMIT;
    } else {
      process.env.MUICV_RESUME_SNAPSHOT_LIMIT = oldLimit;
    }
  }
});
