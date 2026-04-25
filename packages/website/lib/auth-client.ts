import { createAuthClient } from 'better-auth/react';

/**
 * 客户端 auth helpers。Server Component / Server Action 不要用这个，
 * 用 lib/auth.ts 的 getAuth().api.* 直接调用。
 */
export const authClient = createAuthClient({
  // 同源调用，不传 baseURL 即可（fetch 会用 location.origin）
});

export const { signIn, signUp, signOut, useSession } = authClient;
