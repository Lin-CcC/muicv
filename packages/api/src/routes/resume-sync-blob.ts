import { RESUME_SYNC_BLOB_MAX_SIZE_BYTES, RESUME_SYNC_HISTORY_KEEP, validateBlobSummary } from '@muicv/shared';
import type { Context } from 'hono';

import { toErrorMessage } from '../lib/error-message.ts';
import type { AppEnv } from '../middleware/api-key.ts';

type ActiveBlobRow = {
  blobId: string;
  summary: string;
  sizeBytes: number;
  updatedAt: number;
};

type HistoryBlobRow = {
  id: string;
  blobId: string;
  summary: string;
  sizeBytes: number;
  archivedAt: number;
};

const blobObjectKey = (userId: string, blobId: string) => `users/${userId}/blobs/${blobId}.zip`;

/**
 * POST /resume/sync/blob —— skill push 整个素材库的加密 zip 到云端。
 *
 * Content-Type: multipart/form-data
 *   - field `blob`：zip 二进制（≤ 60 MB；服务端不解析内容）
 *   - field `summary`：≤ 500 字符 UTF-8 文本（用户自填的快照描述，无内容侧 schema）
 *
 * 流程：
 *   1. 校验 multipart 字段 / 大小 / summary 长度 + 控制字符
 *   2. 生成新 blobId（uuid）→ R2 put 到 `users/{userId}/blobs/{blobId}.zip`
 *   3. D1 batch：把上一活动版（如有）搬到 history，upsert 新活动版
 *   4. 异步 GC：history 超出 RESUME_SYNC_HISTORY_KEEP 份的，删 D1 row + 删 R2 object
 *
 * 注：history 只搬 D1 metadata，**不**复制 R2 object——blob 本身就是 immutable，活动版变历史
 * 时它对应的 R2 object key 不变，下载时 dashboard 根据 D1 历史 row 的 blobId 直接拉。
 */
export async function handleResumeSyncBlob(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const ct = c.req.header('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    return c.json({ error: 'Content-Type 必须是 multipart/form-data' }, 400);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: 'multipart body 解析失败' }, 400);
  }

  const blobField = form.get('blob');
  // Workers 里 FormDataEntryValue = File | string；非 File（缺字段或纯文本）一律拒
  if (blobField === null || typeof blobField === 'string') {
    return c.json({ error: '字段 `blob` 必须是 multipart 文件' }, 400);
  }
  const blob: Blob = blobField;
  if (blob.size === 0) {
    return c.json({ error: '`blob` 不能为空' }, 400);
  }
  if (blob.size > RESUME_SYNC_BLOB_MAX_SIZE_BYTES) {
    return c.json(
      {
        error: 'blob too large',
        message: `blob 超过 ${RESUME_SYNC_BLOB_MAX_SIZE_BYTES} 字节上限`,
        sizeBytes: blob.size,
        maxBytes: RESUME_SYNC_BLOB_MAX_SIZE_BYTES,
      },
      413,
    );
  }

  const summaryField = form.get('summary');
  const summaryValidation = validateBlobSummary(summaryField);
  if (!summaryValidation.ok) {
    return c.json({ error: summaryValidation.error }, 400);
  }
  const summary = summaryValidation.summary;

  const blobId = crypto.randomUUID();
  const now = Date.now();
  const sizeBytes = blob.size;
  const objectKey = blobObjectKey(userId, blobId);

  // 先写 R2，失败直接 502；R2 写完才动 D1，避免 D1 指向不存在的对象
  try {
    await c.env.MUICV_RESUME_BLOB.put(objectKey, blob.stream(), {
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: { userId, summary },
    });
  } catch (error) {
    return c.json(
      {
        error: 'blob storage failed',
        detail: toErrorMessage(error),
      },
      502,
    );
  }

  const db = c.env.MUICV_API_DB;
  const active = await db
    .prepare('SELECT blobId, summary, sizeBytes, updatedAt FROM resumeSnapshotBlob WHERE userId = ?')
    .bind(userId)
    .first<ActiveBlobRow>();

  const stmts = [] as ReturnType<typeof db.prepare>[];
  if (active) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO resumeSnapshotBlobHistory (id, userId, blobId, summary, sizeBytes, archivedAt) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(crypto.randomUUID(), userId, active.blobId, active.summary, active.sizeBytes, active.updatedAt),
    );
  }
  stmts.push(
    db
      .prepare(
        `INSERT INTO resumeSnapshotBlob (userId, blobId, summary, sizeBytes, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(userId) DO UPDATE SET
           blobId=excluded.blobId,
           summary=excluded.summary,
           sizeBytes=excluded.sizeBytes,
           updatedAt=excluded.updatedAt`,
      )
      .bind(userId, blobId, summary, sizeBytes, now),
  );

  try {
    await db.batch(stmts);
  } catch (error) {
    // D1 写失败 → 回滚刚写的 R2 object，避免孤儿
    c.executionCtx.waitUntil(c.env.MUICV_RESUME_BLOB.delete(objectKey).catch(() => {}));
    return c.json(
      {
        error: 'metadata write failed',
        detail: toErrorMessage(error),
      },
      502,
    );
  }

  // 异步 GC 老历史（D1 row + R2 object）
  c.executionCtx.waitUntil(gcOldBlobHistory(c.env, userId).catch(() => {}));

  return c.json({ blobId, sizeBytes, summary, updatedAt: now });
}

/** GET /resume/snapshot/blob —— 拿活动版元数据（不含 binary） */
export async function handleResumeSnapshotBlobGet(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const row = await c.env.MUICV_API_DB.prepare(
    'SELECT blobId, summary, sizeBytes, updatedAt FROM resumeSnapshotBlob WHERE userId = ?',
  )
    .bind(userId)
    .first<ActiveBlobRow>();

  if (!row) {
    return c.json({ error: 'no-snapshot', message: '云端没有这个用户的加密快照' }, 404);
  }

  return c.json({
    blobId: row.blobId,
    summary: row.summary,
    sizeBytes: row.sizeBytes,
    updatedAt: row.updatedAt,
  });
}

/** GET /resume/snapshot/blob/:id/download —— 下载 zip 二进制 */
export async function handleResumeSnapshotBlobDownload(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const blobId = c.req.param('id');
  if (!blobId || !/^[a-zA-Z0-9-]{8,64}$/.test(blobId)) {
    return c.json({ error: 'invalid blob id' }, 400);
  }

  // 先校验所有权：blobId 必须在该用户的 active 或 history 里
  const owns = await c.env.MUICV_API_DB.prepare(
    `SELECT 1 AS ok FROM resumeSnapshotBlob WHERE userId = ? AND blobId = ?
     UNION ALL
     SELECT 1 AS ok FROM resumeSnapshotBlobHistory WHERE userId = ? AND blobId = ?
     LIMIT 1`,
  )
    .bind(userId, blobId, userId, blobId)
    .first<{ ok: number }>();

  if (!owns) {
    return c.json({ error: 'not-found' }, 404);
  }

  const object = await c.env.MUICV_RESUME_BLOB.get(blobObjectKey(userId, blobId));
  if (!object) {
    // D1 有 row 但 R2 没对象——异常 / 已被 GC，提示用户重 push
    return c.json({ error: 'blob-missing', message: 'blob 已不在存储里，请重新 push' }, 410);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="muicv-resume-${blobId}.zip"`);
  if (object.size != null) headers.set('Content-Length', String(object.size));

  return new Response(object.body, { status: 200, headers });
}

/** DELETE /resume/snapshot/blob —— 清空加密路径快照（活动版 + 全部历史，含 R2 对象） */
export async function handleResumeSnapshotBlobDelete(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const db = c.env.MUICV_API_DB;

  // 列所有要删的 blobId（active + history），先删 R2 再删 D1，保证不留 D1 row 指向不存在对象的孤儿
  const active = await db
    .prepare('SELECT blobId FROM resumeSnapshotBlob WHERE userId = ?')
    .bind(userId)
    .first<{ blobId: string }>();

  const histAll = await db
    .prepare('SELECT blobId FROM resumeSnapshotBlobHistory WHERE userId = ?')
    .bind(userId)
    .all<{ blobId: string }>();

  const blobIds = new Set<string>();
  if (active) blobIds.add(active.blobId);
  for (const row of histAll.results ?? []) blobIds.add(row.blobId);

  for (const blobId of blobIds) {
    await c.env.MUICV_RESUME_BLOB.delete(blobObjectKey(userId, blobId)).catch(() => {});
  }

  await db.batch([
    db.prepare('DELETE FROM resumeSnapshotBlob WHERE userId = ?').bind(userId),
    db.prepare('DELETE FROM resumeSnapshotBlobHistory WHERE userId = ?').bind(userId),
  ]);

  return c.json({ ok: true });
}

/** GET /resume/sync/blob/history —— 列加密快照历史（仅元数据） */
export async function handleResumeBlobHistoryList(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const result = await c.env.MUICV_API_DB.prepare(
    `SELECT id, blobId, summary, sizeBytes, archivedAt
       FROM resumeSnapshotBlobHistory
       WHERE userId = ?
       ORDER BY archivedAt DESC`,
  )
    .bind(userId)
    .all<HistoryBlobRow>();

  return c.json({ items: result.results ?? [] });
}

/**
 * 修剪 history：保留最近 RESUME_SYNC_HISTORY_KEEP 份，多余的连 R2 object 一起删。
 * D1 row 删掉了 R2 object 就成孤儿，所以这里先列 → 再删 R2 → 再删 D1，遇错就停下次再 GC。
 */
async function gcOldBlobHistory(env: CloudflareBindings, userId: string): Promise<void> {
  const all = await env.MUICV_API_DB.prepare(
    `SELECT id, blobId FROM resumeSnapshotBlobHistory
       WHERE userId = ?
       ORDER BY archivedAt DESC`,
  )
    .bind(userId)
    .all<{ id: string; blobId: string }>();

  const rows = all.results ?? [];
  if (rows.length <= RESUME_SYNC_HISTORY_KEEP) return;

  const toRemove = rows.slice(RESUME_SYNC_HISTORY_KEEP);
  for (const row of toRemove) {
    await env.MUICV_RESUME_BLOB.delete(blobObjectKey(userId, row.blobId)).catch(() => {});
    await env.MUICV_API_DB.prepare('DELETE FROM resumeSnapshotBlobHistory WHERE id = ? AND userId = ?')
      .bind(row.id, userId)
      .run()
      .catch(() => {});
  }
}
