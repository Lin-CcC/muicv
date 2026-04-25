/**
 * 订阅档位占位卡 —— M4 起激活实际计费 / 升级流程；这里先把档位规则讲清楚，
 * 让用户对未来怎么收费 / BYOK 与档位的关系有完整心智模型。
 */

const PLANS: Array<{
  key: string;
  label: string;
  price: string;
  highlight?: boolean;
  features: { label: string; ok: boolean | 'limited' }[];
}> = [
  {
    key: 'free',
    label: 'Free',
    price: '¥0',
    features: [
      { label: '每月免费 token 试用', ok: 'limited' },
      { label: '所有 skill / 文件工具', ok: true },
      { label: 'Markdown 简历输出', ok: true },
      { label: '导出 PDF 简历', ok: false },
      { label: '招聘信息库 + 自动抓 JD', ok: false },
      { label: '辅助投递（半自动）', ok: false },
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    price: '待定',
    highlight: true,
    features: [
      { label: '更多平台 token 配额', ok: 'limited' },
      { label: '所有 skill / 文件工具', ok: true },
      { label: 'Markdown 简历输出', ok: true },
      { label: '导出 PDF 简历', ok: true },
      { label: '招聘信息库 + 自动抓 JD', ok: true },
      { label: '辅助投递（每月有限）', ok: 'limited' },
    ],
  },
  {
    key: 'max',
    label: 'Max',
    price: '待定',
    features: [
      { label: '不限平台 token', ok: true },
      { label: '所有 skill / 文件工具', ok: true },
      { label: 'Markdown 简历输出', ok: true },
      { label: '导出 PDF 简历', ok: true },
      { label: '招聘信息库 + 自动抓 JD', ok: true },
      { label: '辅助投递（不限量）', ok: true },
    ],
  },
];

export function PlansSection() {
  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">— 订阅档位</p>
        <h2 className="mt-2 text-[18px] font-extrabold text-ink">
          你现在是 <span className="rounded-md bg-fluff px-2 py-0.5">Free</span>
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          升级 Pro / Max（M4 起激活）解锁 PDF 导出、招聘信息库、辅助投递。
          也可以走 <strong>BYOK</strong>：在上方"muirouter 余额"绑定你自己的 muirouter key，
          所有 LLM 走你自己余额，功能权限同 Free。
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.key}
            className={`rounded-xl border-2 p-5 ${
              p.highlight
                ? 'border-yellow-deep bg-fluff shadow-[0_3px_0_0_var(--color-yellow-deep)]'
                : 'border-rule bg-paper'
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-[16px] font-extrabold text-ink">{p.label}</h3>
              <span className="font-mono text-[13px] font-bold tabular-nums text-yellow-deep">{p.price}</span>
            </div>
            <ul className="mt-4 space-y-1.5 text-[12.5px]">
              {p.features.map((f) => (
                <li key={f.label} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 inline-block w-3 shrink-0 text-center font-bold ${
                      f.ok === true
                        ? 'text-yellow-deep'
                        : f.ok === 'limited'
                          ? 'text-amber'
                          : 'text-mute'
                    }`}
                  >
                    {f.ok === true ? '✓' : f.ok === 'limited' ? '◔' : '×'}
                  </span>
                  <span className={f.ok === false ? 'text-mute line-through' : 'text-ink-soft'}>{f.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-[11px] text-mute">
              {p.key === 'free' && '✓ 你当前所在档位'}
              {p.key === 'pro' && 'M4 起开放升级'}
              {p.key === 'max' && '团队 / 高频投递推荐'}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-rule bg-paper p-4 text-[12.5px] leading-[1.65] text-ink-soft">
        <strong className="text-ink">BYOK（Bring Your Own Key）</strong>：
        在 muirouter.com 注册，把你的 sk-gw key 绑到上面"muirouter 余额"。所有 LLM 调用走你自己的余额，
        muicv 不收 token 费。功能权限同 Free（不含 PDF / 招聘库 / 自动投递），
        但 skill 全套可用，可以手动复制粘贴 JD 文本来分析、生成 markdown 简历。
      </div>
    </section>
  );
}
