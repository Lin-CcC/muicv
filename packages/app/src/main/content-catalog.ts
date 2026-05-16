import type { AppSkillCatalogItem, SkillsCatalogResult } from '../shared/types.ts';

import { getConfig } from './store.ts';

type RawCatalog = {
  manifestVersion?: unknown;
  generatedAt?: unknown;
  skills?: unknown;
};

const CATALOG_TIMEOUT_MS = 10_000;

export async function fetchSkillsCatalog(): Promise<SkillsCatalogResult> {
  const cfg = getConfig();
  const base = cfg.muicvApiBase.replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/skills/catalog`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, message: `目录服务返回 ${res.status}` };
    }
    const raw = (await res.json()) as RawCatalog;
    if (raw.manifestVersion !== 1 || typeof raw.generatedAt !== 'string' || !Array.isArray(raw.skills)) {
      return { ok: false, message: '目录响应格式不正确' };
    }
    return {
      ok: true,
      manifestVersion: 1,
      generatedAt: raw.generatedAt,
      skills: raw.skills as AppSkillCatalogItem[],
    };
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError' ? '目录请求超时' : '暂时拿不到 skill 目录';
    return { ok: false, message };
  } finally {
    clearTimeout(timer);
  }
}
