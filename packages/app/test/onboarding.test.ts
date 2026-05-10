import assert from 'node:assert/strict';
import test from 'node:test';

import { routeFor } from '../src/renderer/lib/store.ts';

const session = {
  id: 'u1',
  email: 'user@example.com',
  name: '用户',
  image: null,
  plan: 'free' as const,
  balance: 10_000,
  hasBYOK: false,
  muirouter: null,
};

test('routeFor 未登录时进入 login', () => {
  assert.equal(routeFor(null, 'chat', false), 'login');
});

test('routeFor 已登录但未完成 onboarding 时进入 onboarding', () => {
  assert.equal(routeFor(session, 'login', false), 'onboarding');
  assert.equal(routeFor(session, 'chat', false), 'onboarding');
});

test('routeFor 已完成 onboarding 后从登录页进入 chat', () => {
  assert.equal(routeFor(session, 'login', true), 'chat');
});

test('routeFor 已完成 onboarding 后保留用户主动切换的视图', () => {
  assert.equal(routeFor(session, 'settings', true), 'settings');
  assert.equal(routeFor(session, 'editor', true), 'editor');
});

test('routeFor onboarding 完成后回到 chat', () => {
  assert.equal(routeFor(session, 'onboarding', true), 'chat');
});
