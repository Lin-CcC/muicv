/**
 * AES-GCM 加解密 muirouterLink 的 OAuth token，与 packages/website/lib/crypto.ts 严格一致：
 * HKDF(SHA-256, ikm=BETTER_AUTH_SECRET, info='muicv:muirouter-link:v1') →
 * AES-GCM 256-bit。两个 worker 必须 wrangler secret put 同一个 BETTER_AUTH_SECRET 才能互通。
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const HKDF_INFO = ENCODER.encode('muicv:muirouter-link:v1');
const HKDF_SALT = ENCODER.encode('muicv-static-salt');

let cache: { secret: string; key: CryptoKey } | undefined;

async function getKey(secret: string): Promise<CryptoKey> {
  if (cache && cache.secret === secret) return cache.key;
  const ikm = await crypto.subtle.importKey('raw', ENCODER.encode(secret), 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  cache = { secret, key };
  return key;
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
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

export async function decryptToken(secret: string, cipher: string, iv: string): Promise<string> {
  const key = await getKey(secret);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBuffer(iv) }, key, base64ToBuffer(cipher));
  return DECODER.decode(plain);
}

export async function encryptToken(secret: string, plaintext: string): Promise<{ cipher: string; iv: string }> {
  const key = await getKey(secret);
  const ivBuf = new ArrayBuffer(12);
  crypto.getRandomValues(new Uint8Array(ivBuf));
  const ptBuf = ENCODER.encode(plaintext).slice().buffer as ArrayBuffer;
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBuf }, key, ptBuf);
  return { cipher: bytesToBase64(cipherBuf), iv: bytesToBase64(ivBuf) };
}
