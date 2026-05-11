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
            一站式 AI 求职平台。简历、找岗位、模拟面试、就业辅导——帮你拿到更好的 offer。
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
              ['重点特性', '/#features'],
              ['定价', '/pricing'],
              ['桌面 app', '/download'],
              ['控制台', '/dashboard'],
            ]}
          />
          <FooterCol
            label="公司"
            links={[
              ['关于我们', '/about'],
              ['联系我们', '/contact'],
            ]}
          />
          <FooterCol
            label="法律"
            links={[
              ['服务条款', '/terms'],
              ['隐私政策', '/privacy'],
            ]}
          />
        </div>
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[12px] text-mute md:flex-row md:items-center md:justify-between md:px-8">
          <span>© 2026 Meathill LLC · Mui简历 · 保留所有权利</span>
          <span className="font-mono text-[11px] uppercase tracking-wider">Made with 🐾 in 中国</span>
        </div>
      </div>
    </footer>
  );
}
