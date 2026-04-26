import { headers } from 'next/headers';

import { getAuth } from '@/lib/auth';

import { FaqAndWaitlist } from './_sections/faq';
import { Footer } from './_sections/footer';
import { Header } from './_sections/header';
import { Hero } from './_sections/hero';
import { Install } from './_sections/install';
import { WhyNotChatbot } from './_sections/why';
import { Workflow } from './_sections/workflow';

// 顶部 nav 要根据登录态切显"登录"或"Dashboard"，所以页面跑 SSR（不要 SSG），
// 否则 build 时 prerender 会失败：Cloudflare D1 在 build context 拿不到。
export const dynamic = 'force-dynamic';

export default async function WebsiteHomePage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const isLoggedIn = !!session?.user;

  return (
    <div className="relative">
      <Header isLoggedIn={isLoggedIn} />
      <Hero />
      <WhyNotChatbot />
      <Workflow />
      <Install />
      <FaqAndWaitlist />
      <Footer />
    </div>
  );
}
