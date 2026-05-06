import { microToDisplay } from '@muicv/shared';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getDb, schema } from '@/lib/db';
import { listLedger, readBalance } from '@/lib/wallet';

import { AdminNav } from '../../_components/admin-nav';
import { GrantForm } from '../../_components/grant-form';

export const dynamic = 'force-dynamic';

const LEDGER_TYPE_LABEL: Record<string, string> = {
  signup_bonus: '注册赠送',
  subscription: '订阅续费',
  topup: '补充包',
  llm: 'LLM 调用',
  pdf_render: 'PDF 渲染',
  jd_fetch: 'JD 抓取',
  stt_transcribe: '语音转写',
  admin_grant: '后台补发',
  admin_deduct: '后台扣款',
};

const SUB_STATUS_LABEL: Record<string, string> = {
  active: '生效中',
  trialing: '试用中',
  past_due: '续费失败（请修复支付方式）',
  canceled: '已取消',
  incomplete: '未完成',
  incomplete_expired: '未完成已过期',
  unpaid: '欠费',
};

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseMeta(meta: string | null): Record<string, unknown> | null {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}

export default async function AdminUserDetailPage(props: { params: Promise<{ userId: string }> }) {
  const { userId } = await props.params;
  const db = await getDb();

  const userRows = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) notFound();

  const balance = await readBalance(userId);
  const subRows = await db
    .select({
      status: schema.subscription.status,
      stripePriceId: schema.subscription.stripePriceId,
      monthlyTokens: schema.subscription.monthlyTokens,
      currentPeriodEnd: schema.subscription.currentPeriodEnd,
      cancelAtPeriodEnd: schema.subscription.cancelAtPeriodEnd,
    })
    .from(schema.subscription)
    .where(eq(schema.subscription.userId, userId))
    .limit(1);
  const sub = subRows[0];

  const ledger = await listLedger(userId, 30);

  return (
    <div className="space-y-6">
      <AdminNav active="/admin/users" />

      <div className="flex items-baseline gap-3">
        <Link href="/admin/users" className="text-[13px] text-ink-soft hover:text-ink">
          ← 返回用户列表
        </Link>
      </div>

      <header className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">— 用户详情</p>
        <h1 className="mt-2 text-[20px] font-extrabold text-ink">{user.name || user.email.split('@')[0]}</h1>
        <p className="mt-1 font-mono text-[13px] text-ink-soft">{user.email}</p>
        <p className="mt-1 font-mono text-[11px] text-mute">
          ID {user.id} · 注册于 {formatTimestamp(user.createdAt.getTime())}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-rule bg-fluff/40 p-3">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">当前余额</dt>
            <dd className="mt-1 font-mono text-[18px] font-extrabold tabular-nums text-yellow-deep">
              {balance ? microToDisplay(balance.balance).toLocaleString() : '0'} tokens
            </dd>
          </div>
          <div className="rounded-lg border border-rule bg-fluff/40 p-3">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">累计获得</dt>
            <dd className="mt-1 font-mono text-[15px] tabular-nums text-ink">
              {balance ? microToDisplay(balance.lifetimeEarned).toLocaleString() : '0'}
            </dd>
          </div>
          <div className="rounded-lg border border-rule bg-fluff/40 p-3">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">累计消耗</dt>
            <dd className="mt-1 font-mono text-[15px] tabular-nums text-ink">
              {balance ? microToDisplay(balance.lifetimeSpent).toLocaleString() : '0'}
            </dd>
          </div>
        </dl>

        {sub && (
          <div className="mt-4 rounded-lg border border-rule bg-cream p-3 text-[13px]">
            <p className="font-bold text-ink">
              订阅：{SUB_STATUS_LABEL[sub.status] ?? sub.status}
              {sub.cancelAtPeriodEnd ? '（周期末取消）' : ''}
            </p>
            {sub.currentPeriodEnd && (
              <p className="mt-1 text-ink-soft">
                下次{sub.cancelAtPeriodEnd ? '到期' : '续费'}：{formatTimestamp(sub.currentPeriodEnd.getTime())}
                {sub.monthlyTokens != null && (
                  <span className="ml-1">（+{sub.monthlyTokens.toLocaleString()} tokens / 周期）</span>
                )}
              </p>
            )}
          </div>
        )}
      </header>

      <section className="rounded-2xl border-2 border-yellow-deep bg-fluff/30 p-6">
        <h2 className="text-[16px] font-extrabold text-ink">赠送 token</h2>
        <p className="mt-1 text-[12.5px] text-ink-soft">
          走 wallet.credit() 原子入账，type=admin_grant，meta 自动写入 grantedBy 与 reason，可在赠予记录页审计。
        </p>
        <div className="mt-4">
          <GrantForm userId={user.id} userEmail={user.email} />
        </div>
      </section>

      <section>
        <h2 className="text-[16px] font-extrabold text-ink">最近交易（30 条）</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-[13px] text-mute">还没有任何流水。</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule rounded-xl border-2 border-rule bg-cream">
            {ledger.map((row) => {
              const meta = parseMeta(row.meta);
              const isAdminAction = row.type === 'admin_grant' || row.type === 'admin_deduct';
              return (
                <li
                  key={row.id}
                  className={`flex items-start justify-between gap-4 px-4 py-3 text-[13px] ${
                    isAdminAction ? 'bg-fluff/40' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{LEDGER_TYPE_LABEL[row.type] ?? row.type}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-mute">{formatTimestamp(row.createdAt)}</p>
                    {isAdminAction && meta && (
                      <p className="mt-1 text-[12px] text-ink-soft">
                        操作人：<span className="font-mono">{String(meta.grantedBy ?? '—')}</span>
                        {' · '}
                        原因：{String(meta.reason ?? '—')}
                      </p>
                    )}
                  </div>
                  <span
                    className={`font-mono text-[14px] font-bold tabular-nums ${
                      row.delta > 0 ? 'text-yellow-deep' : 'text-ink-soft'
                    }`}
                  >
                    {row.delta > 0 ? '+' : ''}
                    {microToDisplay(row.delta).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
