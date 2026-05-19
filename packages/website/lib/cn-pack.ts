import { type CnPackKey, type CnPackPeriod, CN_PACKS, cnPackPeriod } from '@muicv/shared';
import { and, desc, eq } from 'drizzle-orm';

import { getDb, schema } from './db';

/**
 * 查询 user 在某 period（monthly | yearly）下当前是否处于 CN 包 cooldown。
 *
 * 同周期全锁实现：拉该 user 最近 N 条 `tokenLedger.type='cn_pack'`，找到 period 匹配的
 * 最新一条；它的 createdAt + cooldownDays 还没过 → 返回 cooldown 结束时间；否则 null。
 *
 * 不用拉太多——CN 包 cooldown ≥ 30 天，绝大多数用户在 cooldown 期间至多 1 条 record。
 * 拉 limit=20 留余量给 admin_grant / 异常路径不会影响判定。
 *
 * @returns null = 无 cooldown 可买；Date = cooldown 结束时间（UI 显示「下次可购买：YYYY-MM-DD」）
 */
export async function getCnPackCooldownEnd(userId: string, period: CnPackPeriod): Promise<Date | null> {
  const db = await getDb();
  const rows = await db
    .select({ createdAt: schema.tokenLedger.createdAt, meta: schema.tokenLedger.meta })
    .from(schema.tokenLedger)
    .where(and(eq(schema.tokenLedger.userId, userId), eq(schema.tokenLedger.type, 'cn_pack')))
    .orderBy(desc(schema.tokenLedger.createdAt))
    .limit(20);

  const now = Date.now();
  for (const row of rows) {
    const pack = extractPackFromMeta(row.meta);
    if (!pack) continue;
    if (cnPackPeriod(pack) !== period) continue;
    const end = row.createdAt.getTime() + CN_PACKS[pack].cooldownDays * 86_400_000;
    return end > now ? new Date(end) : null;
  }
  return null;
}

function extractPackFromMeta(meta: string | null): CnPackKey | null {
  if (!meta) return null;
  try {
    const m = JSON.parse(meta);
    const k = m?.pack;
    if (typeof k === 'string' && k in CN_PACKS) return k as CnPackKey;
  } catch {
    // 旧/脏数据跳过
  }
  return null;
}
