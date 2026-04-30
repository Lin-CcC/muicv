import { getCloudflareContext } from '@opennextjs/cloudflare';
import { notFound } from 'next/navigation';

import { parseResume } from '@/lib/render/parse-resume';

import { isTemplateName, templates } from './templates/registry';

/** force-dynamic：每次请求都走 KV，不走 ISR / 静态缓存。 */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type StoredResume = {
  markdown: string;
  template?: string;
};

const KV_KEY_PREFIX = 'resume:';
/** UUID v4：8-4-4-4-12 = 36 位含连字符。 */
const TOKEN_RE = /^[0-9a-f-]{36}$/i;

/**
 * Cloudflare KV 是最终一致：packages/api 写完 token 立即触发 puppeteer.goto，
 * 但本 worker 跨 region 读时 propagation 可能还没到，会把简历误判成 404。
 * 实测短延迟内重试就能命中，用累进 delay 限制最差情况下增加的耗时。
 */
const KV_RETRY_DELAYS_MS = [0, 200, 500] as const;

async function readStoredResume(env: CloudflareEnv, token: string): Promise<string | null> {
  for (const delay of KV_RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const raw = await env.MUICV_KV.get(`${KV_KEY_PREFIX}${token}`);
    if (raw) return raw;
  }
  return null;
}

export default async function RenderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();

  const { env } = await getCloudflareContext({ async: true });
  const raw = await readStoredResume(env, token);
  if (!raw) notFound();

  let stored: StoredResume | null = null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredResume>;
    if (typeof parsed?.markdown === 'string' && parsed.markdown.trim()) {
      stored = {
        markdown: parsed.markdown,
        ...(typeof parsed.template === 'string' ? { template: parsed.template } : {}),
      };
    }
  } catch {}
  if (!stored) notFound();

  const resume = await parseResume(stored.markdown);
  const templateName = isTemplateName(stored.template) ? stored.template : 'default';
  const Template = templates[templateName];

  return <Template resume={resume} />;
}
