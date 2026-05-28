import { DesktopApp } from './_sections/desktop-app';
import { FaqAndWaitlist } from './_sections/faq';
import { KeyFeatures } from './_sections/features';
import { Footer } from './_sections/footer';
import { Header } from './_sections/header';
import { Hero } from './_sections/hero';
import { Install } from './_sections/install';
import { Workflow } from './_sections/workflow';

// 首页改 ISR：HTML 由 OpenNext R2 缓存兜底，登录态走 <Header>/<AccountLink> 客户端
// useSession 在水合后补齐。1 小时刷一次足够营销文案的更新节奏。
export const revalidate = 3600;

export default function WebsiteHomePage() {
  return (
    <div className="relative">
      <Header />
      <Hero />
      <KeyFeatures />
      <Workflow />
      <DesktopApp />
      <Install />
      <FaqAndWaitlist />
      <Footer />
    </div>
  );
}
