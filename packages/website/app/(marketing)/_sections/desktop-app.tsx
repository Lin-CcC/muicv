import { ArrowUpRight, Highlight } from '../_icons';

const PLATFORMS: { name: string; sub: string }[] = [
  { name: 'macOS', sub: 'Apple Silicon · Intel' },
  { name: 'Windows', sub: 'x64 · NSIS 安装包' },
  { name: 'Linux', sub: 'x86_64 · AppImage' },
];

export function DesktopApp() {
  return (
    <section id="desktop-app" className="relative overflow-hidden border-b border-rule">
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% 100%, oklch(0.86 0.13 85 / 0.55) 0%, oklch(0.96 0.05 88 / 0.45) 40%, transparent 78%)',
        }}
      />
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-yellow px-3.5 py-1 text-[12px] font-bold text-ink">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-deep" />
              桌面 App · 已上线
            </span>
            <h2 className="mt-5 text-[clamp(1.9rem,3.5vw,2.75rem)] font-extrabold leading-[1.1] tracking-tight">
              不熟悉 AI agent？
              <br />
              <Highlight>下载就能开始</Highlight>。
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.7] text-ink-soft">
              全平台桌面 app，打开就能用。简历、岗位、面试、求职信全部在一个 app 里完成； 云端能力（LLM、PDF 导出、JD
              抓取）按 token 计费，从你的余额扣。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="/download"
                className="press inline-flex items-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[15px] font-bold text-ink"
              >
                下载桌面 app
                <ArrowUpRight />
              </a>
              <a
                href="#install"
                className="text-[13.5px] font-semibold text-ink-soft underline decoration-rule decoration-2 underline-offset-4 transition hover:text-ink hover:decoration-yellow"
              >
                已经在用 AI agent？走 skill 路径 ↓
              </a>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-3">
              {PLATFORMS.map((p) => (
                <a
                  key={p.name}
                  href="/download"
                  className="press-ink group block rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_oklch(0.24_0.04_65)] transition-transform hover:-translate-y-0.5"
                >
                  <p className="text-[15px] font-extrabold text-ink">{p.name}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-mute">{p.sub}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-yellow-deep">
                    下载
                    <ArrowUpRight />
                  </span>
                </a>
              ))}
            </div>
            <p className="mt-5 text-[12px] leading-[1.7] text-mute">
              版本号、安装包大小由{' '}
              <a
                href="/download"
                className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
              >
                下载页
              </a>{' '}
              自动从 GitHub Releases 拉最新。 当前 macOS 已签名 + 公证；Windows / Linux 首次运行可能需要手动放行。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
