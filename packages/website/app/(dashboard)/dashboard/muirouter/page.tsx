import type { Metadata } from 'next';

import { MuirouterSection } from '../muirouter-section';

export const metadata: Metadata = {
  title: 'muirouter (BYOK)',
};

export default function MuirouterPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— muirouter</p>
        <h1 className="mt-3 text-[clamp(1.6rem,3.2vw,2.25rem)] font-extrabold leading-[1.15] tracking-tight text-ink">
          自带 LLM 余额（BYOK）
        </h1>
        <p className="mt-2 max-w-xl text-[14px] text-ink-soft">
          绑定 muirouter API key 后，LLM 调用走你自己的 muirouter 余额；PDF 渲染、JD 抓取仍按 muicv token 扣费。
        </p>
      </header>

      <MuirouterSection />
    </div>
  );
}
