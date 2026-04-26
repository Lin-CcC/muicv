import { eq } from 'drizzle-orm';

import { decryptSecret } from '@/lib/crypto';
import { getDb, schema } from '@/lib/db';
import { fetchMuirouterBalance } from '@/lib/muirouter';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** POST /api/muirouter/refresh —— 重新调 muirouter 拿最新余额。 */
export async function POST(): Promise<Response> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const row = (
    await db.select().from(schema.muirouterLink).where(eq(schema.muirouterLink.userId, session.user.id)).limit(1)
  )[0];

  if (!row) {
    return Response.json({ error: 'not-linked' }, { status: 404 });
  }

  let key: string;
  try {
    key = await decryptSecret(row.keyCipher, row.keyIv);
  } catch {
    // BETTER_AUTH_SECRET 旋转过 → 老 key 无法解密
    return Response.json(
      { error: 'decrypt-failed', message: '加密 key 已失效（可能因 secret 旋转），请重新绑定 muirouter' },
      { status: 500 },
    );
  }

  const result = await fetchMuirouterBalance(key);

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
          // 不清空 balance（保留上次成功的快照），只更新 lastError
          lastError: result.message,
        };

  await db.update(schema.muirouterLink).set(balanceFields).where(eq(schema.muirouterLink.userId, session.user.id));

  return Response.json({
    status: result.status,
    message: result.status === 'ok' ? null : result.message,
    balance:
      result.status === 'ok'
        ? {
            currency: result.balance.currency,
            balanceCents: result.balance.balanceCents,
            lifetimeToppedUpCents: result.balance.lifetimeToppedUpCents,
            lifetimeSpentCents: result.balance.lifetimeSpentCents,
            updatedAt: result.balance.updatedAt.toISOString(),
          }
        : null,
  });
}
