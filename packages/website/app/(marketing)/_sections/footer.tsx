import { CorgiMascot } from '@/components/corgi-mascot';

import { FooterCol } from '../_footer-col';
import { PawIcon } from '../_icons';

export function Footer() {
  return (
    <footer className="bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <a href="/" className="flex items-center gap-2.5 text-ink no-underline">
            <CorgiMascot className="h-9 w-9" />
            <span className="text-[18px] font-bold tracking-tight">Mui简历</span>
          </a>
          <p className="mt-4 max-w-xs text-[13px] leading-[1.65] text-ink-soft">
            在你熟悉的 AI agent 里管理简历。Skills + 本地 Markdown + Cloudflare API。
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-yellow-deep">
            <PawIcon className="h-3.5 w-3.5" />
            由柯基 Mui 监修
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-[13px] sm:grid-cols-3 lg:col-span-7">
          <FooterCol
            label="产品"
            links={[
              ['下载桌面 app', '/download'],
              ['Skill 安装', '#install'],
              ['Dashboard', '/dashboard'],
            ]}
          />
          <FooterCol
            label="文档"
            links={[
              ['walkthrough', 'https://github.com/meathill/muicv/blob/master/docs/walkthrough.md'],
              ['README', 'https://github.com/meathill/muicv#readme'],
              ['DEPLOYMENT', 'https://github.com/meathill/muicv/blob/master/DEPLOYMENT.md'],
            ]}
          />
          <FooterCol
            label="社区"
            links={[
              ['GitHub', 'https://github.com/meathill/muicv'],
              ['Issues', 'https://github.com/meathill/muicv/issues'],
              ['作者博客', 'https://meathill.com'],
            ]}
          />
        </div>
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[12px] text-mute md:flex-row md:items-center md:justify-between md:px-8">
          <span>© 2026 meathill · UNLICENSED（暂时）</span>
          <span className="font-mono text-[11px] uppercase tracking-wider">
            built with skills · cloudflare · puppeteer
          </span>
        </div>
      </div>
    </footer>
  );
}
