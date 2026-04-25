import type { Metadata } from 'next';

import { getAuthFlags } from '@/lib/auth-flags';

import { AuthForm } from '../auth-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '注册',
  description: '注册 Mui简历账号，未来可解锁桌面 app + muirouter 余额管理。',
};

export default async function SignUpPage() {
  const flags = await getAuthFlags();
  return <AuthForm mode="sign-up" githubEnabled={flags.githubEnabled} />;
}
