/**
 * API Key 工具：生成、hash、preview。
 *
 * Key 格式：`mui_<32 字符 base62>`
 *  - mui_ 前缀：让用户一眼就能识别（贴 stack overflow 不会以为是别人的 token）
 *  - 32 字符 base62：~190 bits 熵，足够安全
 *
 * 存储策略：只存 sha256(key)，原文用户复制后我们不再保留。Cloudflare Workers
 * 没有 native bcrypt，但 key 是 high-entropy random，sha256 已经足够（无法
 * brute force）。撤销走 revokedAt 软删。
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PREFIX = 'mui_';
const KEY_BODY_LENGTH = 32;

/** 生成随机 base62 串。Workers crypto.getRandomValues 可用。 */
function randomBase62(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    const byte = bytes[i] ?? 0;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

export function generateApiKey(): string {
  return PREFIX + randomBase62(KEY_BODY_LENGTH);
}

/** SHA-256 hex 哈希。 */
export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 用于 UI 显示的预览：`mui_xxxx…yyyy`
 * （前缀全留 + body 前 4 字符 + 省略号 + 后 4 字符）
 */
export function previewApiKey(key: string): string {
  if (!key.startsWith(PREFIX) || key.length < PREFIX.length + 8) return '••••';
  const body = key.slice(PREFIX.length);
  return `${PREFIX}${body.slice(0, 4)}…${body.slice(-4)}`;
}

/** 校验输入是否长得像合法 muicv key（不验证存在性）。 */
export function looksLikeApiKey(input: unknown): input is string {
  return (
    typeof input === 'string' &&
    input.startsWith(PREFIX) &&
    input.length === PREFIX.length + KEY_BODY_LENGTH &&
    /^mui_[A-Za-z0-9]+$/.test(input)
  );
}
