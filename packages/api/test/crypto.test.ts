import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptToken, encryptToken } from '../src/lib/crypto.ts';

test('encrypt → decrypt 闭环', async () => {
  const secret = 'shared-better-auth-secret';
  const enc = await encryptToken(secret, 'mr_at_hello-world-123');
  assert.match(enc.cipher, /^[A-Za-z0-9+/=]+$/);
  assert.match(enc.iv, /^[A-Za-z0-9+/=]+$/);
  const decoded = await decryptToken(secret, enc.cipher, enc.iv);
  assert.equal(decoded, 'mr_at_hello-world-123');
});

test('decryptToken 错误的 secret 抛 OperationError', async () => {
  const enc = await encryptToken('secret-A', 'payload');
  await assert.rejects(decryptToken('secret-B', enc.cipher, enc.iv));
});
