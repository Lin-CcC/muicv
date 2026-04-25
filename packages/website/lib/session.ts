import { headers } from 'next/headers';

import { getAuth } from './auth';

/**
 * 在 server-side 拿当前 session（含 user）。
 * 未登录返回 null；保护路由时配合 redirect('/sign-in') 用。
 */
export async function getCurrentSession() {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
}
