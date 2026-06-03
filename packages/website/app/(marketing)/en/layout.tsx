import type { Metadata } from 'next';

import { getDictionary } from '../_i18n/dict';

// 英文营销子树。root layout 持有 <html lang="zh-CN">，这里用 wrapper <div lang="en"> 声明英文段落语言
// （无障碍正确；SEO 靠内容 + hreflang，不靠 html lang）。每个英文页自己设 title/openGraph/alternates。
const dict = getDictionary('en');

export const metadata: Metadata = {
  // 英文页用 '%s · MuiCV' 模板（首页用 title.absolute 绕过）；default 给没设 title 的页兜底。
  title: { default: dict.meta.home.title, template: '%s · MuiCV' },
  description: dict.meta.home.description,
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>;
}
