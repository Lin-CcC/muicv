import { displayToMicro, microToDisplay } from '@muicv/shared';
import { eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin';
import { getDb, schema } from '@/lib/db';
import { credit } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

const MAX_GRANT_DISPLAY = 1_000_000;
const MIN_REASON_LEN = 5;

/**
 * POST /api/admin/grant —— 管理员手动给用户加 token。
 *
 * Body: { userId: string; amount: number /* 显示 token，正整数 *\/; reason: string }
 * 返回：{ ok: true; balance: number /* 显示 token *\/; ledgerId 仅复盘用 }
 *
 * 流水类型固定 `admin_grant`，meta 强制写 `{ reason, grantedBy: <admin email> }`，
 * /admin/grants 与用户详情页都按 meta 渲染。不传 ledgerId，每次都生成新行。
 */
export async function POST(request: Request) {
  const session = await requireAdmin();

  let body: { userId?: unknown; amount?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid-json' }, { status: 400 });
  }

  const { userId, amount, reason } = body;
  if (typeof userId !== 'string' || !userId.trim()) {
    return Response.json({ error: 'userId 必填' }, { status: 400 });
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    return Response.json({ error: 'amount 必须是正整数（显示 token）' }, { status: 400 });
  }
  if (amount > MAX_GRANT_DISPLAY) {
    return Response.json({ error: `单次赠予不能超过 ${MAX_GRANT_DISPLAY.toLocaleString()} tokens` }, { status: 400 });
  }
  if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LEN) {
    return Response.json({ error: `reason 至少 ${MIN_REASON_LEN} 字` }, { status: 400 });
  }

  const db = await getDb();
  const target = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (target.length === 0) {
    return Response.json({ error: '用户不存在' }, { status: 404 });
  }

  const result = await credit(userId, displayToMicro(amount), 'admin_grant', {
    reason: reason.trim(),
    grantedBy: session.user.email,
  });

  return Response.json({ ok: true, balance: microToDisplay(result.balance) });
}
