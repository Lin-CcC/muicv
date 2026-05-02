import { microToDisplay } from '@muicv/shared';

import { getCurrentSession } from '@/lib/session';
import { ensureBalance, listLedger } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet —— dashboard 钱包卡 + 流水表用。
 *
 * 返回：{ balance, lifetimeEarned, lifetimeSpent, ledger: [...最近 N 条] }
 * ledger.meta 是 JSON 字符串（前端再 parse），保留原始结构方便显示模型 / pack 等
 * 细节。
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? '20') || 20));

  const wallet = await ensureBalance(session.user.id);
  const ledger = await listLedger(session.user.id, limit);

  return Response.json({
    balance: microToDisplay(wallet.balance),
    ledger: ledger.map((row) => ({ ...row, delta: microToDisplay(row.delta) })),
  });
}
