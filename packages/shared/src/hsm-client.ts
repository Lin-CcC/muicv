/**
 * meathill HSM 客户端纯逻辑——把 OAuth token / 任何敏感字符串外包给
 * https://hsm.meathill.com 之类的信封加密服务存储，本仓库不再持有任何密钥派生代码。
 *
 * 服务端协议（见 https://hsm.meathill.com/SKILL.md）：
 *   PUT    /keys/:path  body {value:string}    Header X-HSM-Secret  → 200 metadata
 *   GET    /keys/:path                          Header X-HSM-Secret  → 200 {value}
 *   DELETE /keys/:path                          Header X-HSM-Secret  → 204
 *
 * 单次 value 长度上限 8192 字符。OAuth access+refresh 序列化成 JSON 远低于此。
 *
 * 不读 env 不依赖运行时；调用方传 baseUrl + secret。
 */

export type HsmConfig = {
  baseUrl: string;
  secret: string;
};

export class HsmError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function buildUrl(config: HsmConfig, path: string): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  // path 内允许 `/`，按段 encode
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${base}/keys/${encoded}`;
}

function headers(config: HsmConfig, withBody: boolean): HeadersInit {
  const h: HeadersInit = { 'X-HSM-Secret': config.secret };
  if (withBody) (h as Record<string, string>)['Content-Type'] = 'application/json';
  return h;
}

/** 写入或覆盖一个 path 的 value。失败抛 HsmError。 */
export async function hsmPut(config: HsmConfig, path: string, value: string): Promise<void> {
  if (value.length > 8192) {
    throw new HsmError('value-too-long', `HSM value 超过 8192 字符上限：${value.length}`, 400);
  }
  let res: Response;
  try {
    res = await fetch(buildUrl(config, path), {
      method: 'PUT',
      headers: headers(config, true),
      body: JSON.stringify({ value }),
    });
  } catch (err) {
    throw new HsmError('network', `HSM 网络错误：${err instanceof Error ? err.message : String(err)}`, 502);
  }
  if (!res.ok) {
    throw new HsmError('http', `HSM PUT ${res.status}：${(await res.text()).slice(0, 200)}`, res.status);
  }
}

/** 读取 path 的 value。404 返回 null（调用方决定是否报错）；其它失败抛 HsmError。 */
export async function hsmGet(config: HsmConfig, path: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(buildUrl(config, path), {
      method: 'GET',
      headers: headers(config, false),
    });
  } catch (err) {
    throw new HsmError('network', `HSM 网络错误：${err instanceof Error ? err.message : String(err)}`, 502);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new HsmError('http', `HSM GET ${res.status}：${(await res.text()).slice(0, 200)}`, res.status);
  }
  let body: { value?: unknown };
  try {
    body = (await res.json()) as { value?: unknown };
  } catch {
    throw new HsmError('invalid-json', 'HSM 响应不是合法 JSON', 502);
  }
  if (typeof body.value !== 'string') {
    throw new HsmError('invalid-shape', 'HSM 响应缺 value 字段', 502);
  }
  return body.value;
}

/** 删除 path。404 视为成功（幂等）；其它失败抛 HsmError。 */
export async function hsmDelete(config: HsmConfig, path: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(buildUrl(config, path), {
      method: 'DELETE',
      headers: headers(config, false),
    });
  } catch (err) {
    throw new HsmError('network', `HSM 网络错误：${err instanceof Error ? err.message : String(err)}`, 502);
  }
  if (res.status === 404) return;
  if (!res.ok) {
    throw new HsmError('http', `HSM DELETE ${res.status}：${(await res.text()).slice(0, 200)}`, res.status);
  }
}

/** muirouter token 在 HSM 里存一份 JSON：access + refresh 一起拿一起删。 */
export type StoredMuirouterTokens = {
  accessToken: string;
  refreshToken: string;
};

export function muirouterHsmPath(userId: string): string {
  // 把可能出现的 `/` `:` 等转成 _ 防路径歧义。better-auth user.id 一般是 alphanumeric，
  // 但 OAuth provider id 有 `:`，做一层兜底。
  const safe = userId.replace(/[^A-Za-z0-9_-]/g, '_');
  return `muicv/muirouter/${safe}`;
}
