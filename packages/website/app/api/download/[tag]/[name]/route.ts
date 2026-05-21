import { getCloudflareContext } from '@opennextjs/cloudflare';

import { isMainlandChina } from '@/lib/region';

export const dynamic = 'force-dynamic';

const REPO = 'meathill/muicv';

/**
 * GET /api/download/:tag/:name —— 安装包下载入口。
 *
 * 非中国大陆：302 重定向到 GitHub release 资产（等同直连，零代理开销）。
 * 中国大陆：由本 Worker 流式代理 GitHub，并用 Cloudflare 边缘缓存住不可变的 release 资产，
 * 绕开经常被墙/重置的 GitHub release CDN。
 *
 * REPO 固定 + 只拼 `releases/download/<tag>/<name>`，不接收任意 URL，无 SSRF / open-proxy 风险。
 */
export async function GET(request: Request, { params }: { params: Promise<{ tag: string; name: string }> }) {
  const { tag, name } = await params;
  if (!isSafeSegment(tag) || !isSafeSegment(name)) {
    return new Response('bad request', { status: 400 });
  }

  const githubUrl = `https://github.com/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;

  // 非 CN：直连 GitHub，不经代理。
  if (!isMainlandChina(request)) {
    return Response.redirect(githubUrl, 302);
  }

  // workerd 的 caches.default 是 Cloudflare 区域缓存；DOM lib 的 CacheStorage 类型里没有 default，故 cast。
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(request.url);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const upstream = await fetch(githubUrl, {
    redirect: 'follow',
    headers: { 'user-agent': 'muicv-website' },
  });
  // 上游异常时回退到直连，至少不挡住用户。
  if (!upstream.ok || !upstream.body) {
    return Response.redirect(githubUrl, 302);
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers.set('content-length', contentLength);
  const disposition = upstream.headers.get('content-disposition');
  headers.set('content-disposition', disposition ?? `attachment; filename="${name.replace(/["\r\n]/g, '')}"`);
  // release 资产按 (tag, name) 不可变，安全长缓存。
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  const response = new Response(upstream.body, { status: 200, headers });

  const { ctx } = await getCloudflareContext({ async: true });
  // put 失败（超出缓存对象上限等）静默忽略，回退到每次回源。
  ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));

  return response;
}

/** 路径段安全校验：Next 已保证段内无 `/`，再挡掉空值与 `..` 防穿越。 */
function isSafeSegment(value: string): boolean {
  return value.length > 0 && !value.includes('/') && !value.includes('..');
}
