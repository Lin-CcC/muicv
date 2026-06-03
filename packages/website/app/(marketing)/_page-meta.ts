import type { Metadata } from 'next';

import type { Locale } from './_i18n/locale';

const SITE_URL = 'https://muicv.com';

// 双语营销页统一 metadata：canonical 自指 + hreflang 互指 + 完整 openGraph/twitter。
// title 为纯串，走各自 layout 的模板（zh ' · Mui简历' / en ' · MuiCV'）。首页用 title.absolute 不走这里。
export function pageMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale;
  /** 中文路径，如 '/about'；英文路径自动推导为 '/en' 前缀。 */
  path: string;
  title: string;
  description: string;
}): Metadata {
  const enPath = path === '/' ? '/en' : `/en${path}`;
  const canonical = locale === 'en' ? enPath : path;
  return {
    title,
    description,
    alternates: { canonical, languages: { 'zh-CN': path, en: enPath, 'x-default': path } },
    openGraph: {
      type: 'website',
      siteName: locale === 'en' ? 'MuiCV' : 'Mui简历',
      url: `${SITE_URL}${canonical}`,
      locale: locale === 'en' ? 'en_US' : 'zh_CN',
      title,
      description,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}
