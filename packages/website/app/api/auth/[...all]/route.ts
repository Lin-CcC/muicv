import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/lib/auth';

/**
 * Better Auth catch-all route —— 把 /api/auth/sign-in、/sign-up、/get-session、
 * /sign-out、/oauth/* 等所有端点都接到 Better Auth handler。
 *
 * 因为 OpenNext 下 auth 实例必须 async 初始化（依赖 getCloudflareContext），
 * 这里 lazy 包装两个 handler。
 */

async function handler(request: Request) {
  const auth = await getAuth();
  const { GET, POST } = toNextJsHandler(auth);
  return request.method === 'POST' ? POST(request) : GET(request);
}

export const GET = handler;
export const POST = handler;
