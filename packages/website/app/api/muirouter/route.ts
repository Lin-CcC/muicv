import { eq } from 'drizzle-orm';
import { revokeToken } from '@muicv/shared';

import { decryptSecret } from '@/lib/crypto';
import { getDb, schema } from '@/lib/db';
import { getMuirouterOauthConfig } from '@/lib/muirouter-config';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

type LinkStatus = {
  linked: boolean;
  email?: string | null;
  linkedAt?: string | undefined;
  defaultModel?: string | undefined;
  scope?: string | null | undefined;
  currency?: string | undefined;
  balanceCents?: number | undefined;
  lifetimeToppedUpCents?: number | null | undefined;
  lifetimeSpentCents?: number | null | undefined;
  balanceUpdatedAt?: string | undefined;
  lastError?: string | undefined;
};

/** GET /api/muirouter —— 当前用户的 muirouter 关联状态（不返回 token 原文）。 */
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
        email: row.muirouterEmail,
        linkedAt: row.linkedAt.toISOString(),
        defaultModel: row.defaultModel,
        scope: row.scope,
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
 * DELETE /api/muirouter —— 解绑。
 * 解密 access_token、调 muirouter /oauth/revoke（best-effort），删表。
 * revoke 失败也继续删本地，因为本地一旦删表 muicv 就再用不了 token。
 */
export async function DELETE(): Promise<Response> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = await getDb();
  const row = (
    await db.select().from(schema.muirouterLink).where(eq(schema.muirouterLink.userId, session.user.id)).limit(1)
  )[0];
  if (row) {
    try {
      const accessToken = await decryptSecret(row.accessTokenCipher, row.accessTokenIv);
      const config = await getMuirouterOauthConfig();
      await revokeToken({ endpoints: config.endpoints, client: config.client, token: accessToken });
    } catch {
      // 解密失败 / revoke 失败都不阻塞本地删除
    }
    await db.delete(schema.muirouterLink).where(eq(schema.muirouterLink.userId, session.user.id));
  }
  return Response.json({ ok: true });
}
