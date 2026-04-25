import type { Metadata } from 'next';

import { getAuthFlags } from '@/lib/auth-flags';

import { AuthForm } from '../auth-form';

// 要 await 服务端 env，强制 SSR
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '登录',
  description: '登录 Mui简历，管理你的简历素材库与订阅。',
};

export default async function SignInPage() {
  const flags = await getAuthFlags();
  return <AuthForm mode="sign-in" githubEnabled={flags.githubEnabled} />;
}
