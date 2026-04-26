const PRINCIPLES: { n: string; t: string; d: string }[] = [
  {
    n: '01',
    t: '数据主权',
    d: '所有素材是 Markdown 文件，存在你自己的项目里。要不要入 git、备份、同步——完全由你决定。',
  },
  {
    n: '02',
    t: 'agent 无关',
    d: '一套 skill 在 Claude Code、Codex、Cursor、OpenCode 等 40+ agent 通用。换工具不换数据。',
  },
  {
    n: '03',
    t: '不编造',
    d: '所有生成严格限定在你明确写下的事实里。缺素材就追问或留空，绝不替你"发挥"。',
  },
];

export function WhyNotChatbot() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 设计原则</p>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-tight">
              为什么
              <br />
              <span className="relative inline-block">
                <span
                  className="absolute inset-x-[-4px] bottom-[8%] -z-10 h-[36%] -skew-y-2 rounded-sm bg-corgi/80"
                  aria-hidden
                />
                <span className="relative">不</span>
              </span>{' '}
              做 Chatbot？
            </h2>
          </div>
          <div className="lg:col-span-8">
            <p className="text-[clamp(1.2rem,1.8vw,1.45rem)] font-semibold leading-[1.5] text-ink">
              AI agent 本身就会对话、有记忆、能操作文件——再做一遍 chat UI 和记忆库是重复建设。 Mui简历只做 AI agent
              做不好的事：结构化的简历工作流，和服务端能力。
            </p>

            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              {PRINCIPLES.map((item) => (
                <div
                  key={item.n}
                  className="rounded-2xl border-2 border-ink bg-cream p-5 transition-transform hover:-translate-y-1"
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-yellow text-sm font-extrabold text-ink tabular-nums">
                    {item.n}
                  </div>
                  <div className="mt-3 text-[15px] font-bold text-ink">{item.t}</div>
                  <p className="mt-1.5 text-[14px] leading-[1.65] text-ink-soft">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
