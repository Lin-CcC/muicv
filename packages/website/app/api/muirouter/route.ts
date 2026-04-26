import { eq } from 'drizzle-orm';

import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { getDb, schema } from '@/lib/db';
import { fetchMuirouterBalance, looksLikeMuirouterKey, previewMuirouterKey } from '@/lib/muirouter';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

type LinkStatus = {
  linked: boolean;
  preview?: string | undefined;
  linkedAt?: string | undefined;
  currency?: string | undefined;
  balanceCents?: number | undefined;
  lifetimeToppedUpCents?: number | null | undefined;
  lifetimeSpentCents?: number | null | undefined;
  balanceUpdatedAt?: string | undefined;
  lastError?: string | undefined;
};

/** GET /api/muirouter —— 当前用户的 muirouter 关联状态（不返回 raw key）。 */
export async function GET(): Promise<Response> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const row = (
    await db.select().from(schema.muirouterLink).where(eq(schema.muirouterLink.userId, session.user.id)).limit(1)
  )[0];

  const status: LinkStatus = row
    ? {
        linked: true,
        preview: row.keyPreview,
        linkedAt: row.linkedAt.toISOString(),
        currency: row.currency ?? undefined,
        balanceCents: row.balanceCents ?? undefined,
        lifetimeToppedUpCents: row.lifetimeToppedUpCents ?? null,
        lifetimeSpentCents: row.lifetimeSpentCents ?? null,
        balanceUpdatedAt: row.balanceUpdatedAt?.toISOString(),
        lastError: row.lastError ?? undefined,
      }
    : { linked: false };

  return Response.json(status);
}

/**
 * POST /api/muirouter —— 绑定 / 替换 muirouter API key。
 * Body: { key: string }
 * 流程：
 *   1. 校验 key 长得像合法 muirouter key
 *   2. 立刻调一次 muirouter /balance 验证（拿不通也存，但记 lastError）
 *   3. AES-GCM 加密 key 存到 muirouterLink（per-user 单条 upsert）
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (!looksLikeMuirouterKey(body.key)) {
    return Response.json({ error: 'invalid-key', message: '看上去不像合法的 muirouter API key' }, { status: 400 });
  }

  const rawKey = body.key.trim();
  const result = await fetchMuirouterBalance(rawKey);

  // 401 直接拒绝绑定（key 无效）。其他状态（pending / error / ok）都允许绑定，
  // 只是把 lastError / balance 字段相应记录。
  if (result.status === 'invalid') {
    return Response.json({ error: 'invalid-key', message: result.message }, { status: 400 });
  }

  const { cipher, iv } = await encryptSecret(rawKey);
  const preview = previewMuirouterKey(rawKey);
  const now = new Date();

  const db = await getDb();

  const balanceFields =
    result.status === 'ok'
      ? {
          currency: result.balance.currency,
          balanceCents: result.balance.balanceCents,
          lifetimeToppedUpCents: result.balance.lifetimeToppedUpCents,
          lifetimeSpentCents: result.balance.lifetimeSpentCents,
          balanceUpdatedAt: result.balance.updatedAt,
          lastError: null,
        }
      : {
          currency: null,
          balanceCents: null,
          lifetimeToppedUpCents: null,
          lifetimeSpentCents: null,
          balanceUpdatedAt: null,
          lastError: result.message,
        };

  await db
    .insert(schema.muirouterLink)
    .values({
      userId: session.user.id,
      keyCipher: cipher,
      keyIv: iv,
      keyPreview: preview,
      linkedAt: now,
      ...balanceFields,
    })
    .onConflictDoUpdate({
      target: schema.muirouterLink.userId,
      set: {
        keyCipher: cipher,
        keyIv: iv,
        keyPreview: preview,
        linkedAt: now,
        ...balanceFields,
      },
    });

  return Response.json(
    {
      ok: true,
      preview,
      balanceStatus: result.status,
      message: result.status === 'ok' ? null : result.message,
    },
    { status: 201 },
  );
}

/** DELETE /api/muirouter —— 解绑。 */
export async function DELETE(): Promise<Response> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = await getDb();
  await db.delete(schema.muirouterLink).where(eq(schema.muirouterLink.userId, session.user.id));
  return Response.json({ ok: true });
}
