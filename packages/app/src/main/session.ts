import type { SessionCheckResult, SessionInfo } from '../shared/types.ts';
import { inferWebBase } from './deep-link.ts';
import { getConfig, patchConfig } from './store.ts';

/**
 * 用一个 mui_ key 调 GET <webBase>/api/me 验证。
 *
 * 注意：/api/me 住在 website worker（muicv.com），不是 api worker
 * （api.muicv.com）。这样登录功能不依赖 api worker 是否上线——api worker
 * 只负责 LLM 代理 / PDF 渲染等"重资源"。webBase 由 muicvApiBase 派生
 * （见 deep-link.ts 的 inferWebBase）。
 *
 * 把网络错 / 401 / 4xx 区分清楚返回，让 renderer 给出准确提示。
 */
async function fetchMe(apiBase: string, key: string): Promise<SessionCheckResult> {
  const webBase = inferWebBase(apiBase);
  let res: Response;
  try {
    res = await fetch(`${webBase.replace(/\/$/, '')}/api/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    return {
      status: 'network-error',
      message: err instanceof Error ? err.message : '无法连接 muicv 服务',
    };
  }

  if (res.status === 401) {
    let message = 'API key 无效或已被撤销';
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    return { status: 'invalid-key', message };
  }

  if (!res.ok) {
    return {
      status: 'invalid-key',
      message: `muicv 服务端返回 ${res.status}`,
    };
  }

  let body: SessionInfo;
  try {
    body = (await res.json()) as SessionInfo;
  } catch {
    return { status: 'invalid-key', message: '服务端响应格式错' };
  }

  return { status: 'ok', session: body };
}

/** 用当前已存的 mui_ key 验证 session。没存 key 返回 no-key。 */
export async function checkSession(): Promise<SessionCheckResult> {
  const cfg = getConfig();
  if (!cfg.muicvApiKey) return { status: 'no-key' };
  return fetchMe(cfg.muicvApiBase, cfg.muicvApiKey);
}

/** 仅试登录（验证候选 key），不写 store。 */
export async function verifyCandidateKey(candidate: string): Promise<SessionCheckResult> {
  const trimmed = candidate.trim();
  if (!trimmed) return { status: 'invalid-key', message: 'API key 不能为空' };
  const cfg = getConfig();
  return fetchMe(cfg.muicvApiBase, trimmed);
}

/** 验证候选 key 通过 → 写到 store，返回 session。 */
export async function loginWithKey(candidate: string): Promise<SessionCheckResult> {
  const result = await verifyCandidateKey(candidate);
  if (result.status === 'ok') {
    patchConfig({ muicvApiKey: candidate.trim() });
  }
  return result;
}

/** 清 mui_ key（不动其它配置如工作目录，让用户切账号也方便重登）。 */
export function logout(): void {
  patchConfig({ muicvApiKey: null });
}
