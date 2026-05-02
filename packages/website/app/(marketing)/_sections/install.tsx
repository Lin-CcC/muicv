import { Highlight } from '../_icons';
import { InstallCard } from '../_install-card';

export function Install() {
  return (
    <section id="install" className="relative overflow-hidden border-b border-rule">
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% 0%, oklch(0.86 0.13 85 / 0.65) 0%, oklch(0.96 0.05 88 / 0.5) 35%, transparent 75%)',
        }}
      />
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-cream px-3.5 py-1 text-[12px] font-bold text-ink">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-deep" />
              已经可用 · 5 秒装完
            </span>
            <h2 className="mt-5 text-[clamp(1.9rem,3.5vw,2.75rem)] font-extrabold leading-[1.1] tracking-tight">
              已经在用 AI agent？
              <br />
              <Highlight>现在就能开始</Highlight>。
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.7] text-ink-soft">
              不需要等桌面 app。装了 Claude Code、Codex、Cursor、OpenCode 等任何一种支持 skill 协议的
              agent，用下面这条命令，5 秒装完。
            </p>
            <p className="mt-4 max-w-md text-[13px] leading-[1.7] text-mute">
              不熟悉 AI agent？等桌面 app 上线即可，
              <a
                href="/#waitlist"
                className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
              >
                留下邮箱
              </a>
              第一时间收到通知。
            </p>
          </div>

          <div className="grid gap-4 lg:col-span-7">
            <InstallCard title="npx skills" meta="多 agent 通用 / 40+ 兼容" code={`npx skills add muicv -g`} />
          </div>
        </div>
      </div>
    </section>
  );
}
