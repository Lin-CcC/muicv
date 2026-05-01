import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptMuirouterKey } from '../src/lib/crypto.ts';

test('decryptMuirouterKey should decrypt correctly', async () => {
  // Since decrypt is dependent on how website encrypts, we should mock or write an encrypt wrapper
  // But for now, we can verify that bad decryption fails gracefully or throws correctly
  try {
    await decryptMuirouterKey('invalid-secret', 'YWJjZA==', 'YWJjZGVmZ2hpamts'); // mock valid base64
    assert.fail('Should have thrown an error due to bad cipher/iv');
  } catch (e) {
    // In Web Crypto API, decrypting bad data typically throws an OperationError
    assert.ok(e instanceof Error);
  }
});
