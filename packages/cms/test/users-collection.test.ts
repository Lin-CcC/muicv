import assert from 'node:assert/strict';
import test from 'node:test';

import { Users } from '../collections/users.ts';

test('users collection 开启 Payload API Key', () => {
  assert.deepEqual(Users.auth, {
    useAPIKey: true,
  });
});
