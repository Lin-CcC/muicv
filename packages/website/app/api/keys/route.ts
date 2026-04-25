import { and, desc, eq, isNull } from 'drizzle-orm';

import { generateApiKey, hashApiKey, previewApiKey } from '@/lib/api-key';
import { getDb, schema } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/keys —— 列出当前用户**未撤销**的 keys。 */
export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const rows = await db
    .select({
      id: schema.apiKey.id,
      name: schema.apiKey.name,
      keyPreview: schema.apiKey.keyPreview,
      lastUsedAt: schema.apiKey.lastUsedAt,
      createdAt: schema.apiKey.createdAt,
    })
    .from(schema.apiKey)
    .where(and(eq(schema.apiKey.userId, session.user.id), isNull(schema.apiKey.revokedAt)))
    .orderBy(desc(schema.apiKey.createdAt));

  return Response.json({ keys: rows });
}

/**
 * POST /api/keys —— 创建一个新 key。
 * Body: { name?: string }
 * 响应：{ id, name, key, keyPreview, createdAt } —— **key 是原文，仅此一次返回**。
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { name?: unknown } = {};
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      body = await request.json();
    }
  } catch {
    /* 允许空 body */
  }

  const rawName = typeof body.name === 'string' ? body.name.trim() : '';
  const name = rawName.length > 0 && rawName.length <= 64 ? rawName : 'Untitled key';

  const db = await getDb();

  // 简单上限：每个用户最多 10 个 active key
  const activeCount = (
    await db
      .select({ id: schema.apiKey.id })
      .from(schema.apiKey)
      .where(and(eq(schema.apiKey.userId, session.user.id), isNull(schema.apiKey.revokedAt)))
  ).length;
  if (activeCount >= 10) {
    return Response.json(
      { error: 'too-many-keys', detail: '一个账号最多 10 个有效 key，先撤销几个再来。' },
      { status: 400 },
    );
  }

  const key = generateApiKey();
  const keyHash = await hashApiKey(key);
  const keyPreview = previewApiKey(key);
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.apiKey).values({
    id,
    userId: session.user.id,
    name,
    keyHash,
    keyPreview,
    createdAt: now,
  });

  return Response.json(
    {
      id,
      name,
      key, // 原文：客户端必须立刻保存
      keyPreview,
      createdAt: now.toISOString(),
    },
    { status: 201 },
  );
}
