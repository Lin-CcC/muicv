import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * muirouter 端可选模型列表。短期硬编码以让 UI 立刻可用——后续接 muirouter `/v1/models`
 * 时改成 fetch + KV 缓存 1h，调用方接口不变。
 */
const KNOWN_MODELS: Array<{ id: string; label: string; hint?: string }> = [
  { id: 'mimo', label: 'mimo（国产）', hint: '默认，性价比最高' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', hint: '英文场景' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: '中文长文本' },
];

const MODEL_IDS = new Set(KNOWN_MODELS.map((m) => m.id));

/** GET /api/muirouter/model —— 返回可选模型列表 + 当前用户的 defaultModel。 */
export async function GET(): Promise<Response> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = await getDb();
  const row = (
    await db
      .select({ defaultModel: schema.muirouterLink.defaultModel })
      .from(schema.muirouterLink)
      .where(eq(schema.muirouterLink.userId, session.user.id))
      .limit(1)
  )[0];
  return Response.json({ models: KNOWN_MODELS, defaultModel: row?.defaultModel ?? null });
}

/** PATCH /api/muirouter/model —— 更新当前用户的 defaultModel。Body: { model: string } */
export async function PATCH(request: Request): Promise<Response> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: { model?: unknown } = {};
  try {
    body = (await request.json()) as { model?: unknown };
  } catch {
    return Response.json({ error: 'invalid-body' }, { status: 400 });
  }
  if (typeof body.model !== 'string' || !MODEL_IDS.has(body.model)) {
    return Response.json({ error: 'invalid-model' }, { status: 400 });
  }
  const db = await getDb();
  await db
    .update(schema.muirouterLink)
    .set({ defaultModel: body.model })
    .where(eq(schema.muirouterLink.userId, session.user.id));
  // drizzle d1 update 不抛错，行不存在等价于 no-op；查一次确认绑定还在
  const after = (
    await db
      .select({ defaultModel: schema.muirouterLink.defaultModel })
      .from(schema.muirouterLink)
      .where(eq(schema.muirouterLink.userId, session.user.id))
      .limit(1)
  )[0];
  if (!after) {
    return Response.json({ error: 'not-linked' }, { status: 404 });
  }
  return Response.json({ ok: true, defaultModel: after.defaultModel });
}
