import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * 用 BETTER_AUTH_SECRET 派生一把 AES-GCM key 加解密 muirouter API key。
 *
 * 不用单独再 put 一份 ENCRYPTION_KEY secret，省一次 secret 管理；
 * BETTER_AUTH_SECRET 旋转时这边自动跟着失效，行为可预期。
 *
 * 实现：HKDF(SHA-256, ikm=secret, info='muicv:muirouter-link:v1', length=32B)
 * → AES-GCM 256bit。
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const HKDF_INFO = ENCODER.encode('muicv:muirouter-link:v1');
const HKDF_SALT = ENCODER.encode('muicv-static-salt');

let cachedKey: CryptoKey | undefined;

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const { env } = await getCloudflareContext({ async: true });
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET 未配置，无法加密 muirouter key');
  }
  const ikm = await crypto.subtle.importKey('raw', ENCODER.encode(secret), 'HKDF', false, ['deriveKey']);
  cachedKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return cachedKey;
}

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return btoa(s);
}

function base64ToBuffer(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
}

function randomIv(): ArrayBuffer {
  const buf = new ArrayBuffer(12);
  crypto.getRandomValues(new Uint8Array(buf));
  return buf;
}

/** 加密一段明文，返回 { cipher, iv }（都是 base64）。 */
export async function encryptSecret(plaintext: string): Promise<{ cipher: string; iv: string }> {
  const key = await getEncryptionKey();
  const iv = randomIv();
  // ArrayBuffer (not SharedArrayBuffer) ensures BufferSource compatibility
  const ptBuf = ENCODER.encode(plaintext).slice().buffer as ArrayBuffer;
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ptBuf);
  return {
    cipher: bytesToBase64(cipherBuf),
    iv: bytesToBase64(iv),
  };
}

/** 解密。失败抛错（可能是 secret 旋转或数据损坏）。 */
export async function decryptSecret(cipher: string, iv: string): Promise<string> {
  const key = await getEncryptionKey();
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(iv) },
    key,
    base64ToBuffer(cipher),
  );
  return DECODER.decode(plainBuf);
}
