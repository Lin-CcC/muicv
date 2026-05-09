import { getConfig } from './store.ts';

/**
 * Feedback 模块（main 进程）：把 renderer 的"赞 / 踩 / 聊聊"请求转成 HTTPS 调
 * packages/api 的 /feedback/* 端点。API key 走 main 进程是因为 muicvApiKey 加密存在
 * electron-store 里，renderer 不该直接拿到原文。
 *
 * 网络错 / 鉴权错 / 业务 4xx 都归一成 FeedbackResult，让 renderer 用同一份 UI 处理。
 */

export type FeedbackError =
  | 'no-api-key' // 用户还没登录（muicvApiKey 没配）
  | 'network-error' // fetch 抛错（DNS / 离线 / 超时）
  | 'invalid-key' // 401，key 失效
  | 'bad-request' // 4xx，参数 / 业务校验失败
  | 'server-error'; // 5xx 或其它

export type FeedbackRateResponse = {
  ok: true;
  feedbackId: string;
  rating: 'praise' | 'dislike';
  awarded: number; // 显示 token
  alreadyRewarded: boolean;
  balance: number; // 显示 token
};

export type FeedbackCommentResponse = {
  ok: true;
  feedbackId: string;
  charCount: number;
  awarded: number; // 显示 token
  balance: number; // 显示 token
  minChars: number;
  maxChars: number;
};

export type FeedbackResult<T> = { ok: true; data: T } | { ok: false; error: FeedbackError; message: string };

const REQUEST_TIMEOUT_MS = 10_000;

async function postJson<T>(path: string, body: unknown): Promise<FeedbackResult<T>> {
  const cfg = getConfig();
  if (!cfg.muicvApiKey) {
    return { ok: false, error: 'no-api-key', message: '需要先登录 muicv 才能反馈' };
  }
  const url = `${cfg.muicvApiBase.replace(/\/$/, '')}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.muicvApiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    return {
      ok: false,
      error: 'network-error',
      message: err instanceof Error ? err.message : '网络异常',
    };
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    return { ok: false, error: 'invalid-key', message: 'API key 无效或已被撤销，请重新登录' };
  }
  if (res.status >= 400 && res.status < 500) {
    let message = `请求被拒绝（${res.status}）`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    return { ok: false, error: 'bad-request', message };
  }
  if (!res.ok) {
    return { ok: false, error: 'server-error', message: `服务端错误（${res.status}）` };
  }

  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'server-error', message: '服务端响应格式错' };
  }
}

export type RateArgs = {
  messageId: string;
  conversationId: string;
  rating: 'praise' | 'dislike';
};

export async function rateFeedback(args: RateArgs): Promise<FeedbackResult<FeedbackRateResponse>> {
  return postJson<FeedbackRateResponse>('/feedback/rate', args);
}

export type CommentArgs = {
  messageId: string;
  conversationId: string;
  text: string;
};

export async function commentFeedback(args: CommentArgs): Promise<FeedbackResult<FeedbackCommentResponse>> {
  return postJson<FeedbackCommentResponse>('/feedback/comment', args);
}
