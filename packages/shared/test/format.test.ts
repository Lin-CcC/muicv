import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCents } from '../src/format.ts';

describe('formatCents', () => {
  it('null / undefined / NaN → 占位符', () => {
    assert.equal(formatCents(null), '—');
    assert.equal(formatCents(undefined), '—');
    assert.equal(formatCents(Number.NaN), '—');
    assert.equal(formatCents(Number.POSITIVE_INFINITY), '—');
  });

  it('CNY (默认) 用 ¥ 符号', () => {
    assert.equal(formatCents(0), '¥0.00');
    assert.equal(formatCents(123), '¥1.23');
    assert.equal(formatCents(99_99), '¥99.99');
  });

  it('USD 用 $ 符号', () => {
    assert.equal(formatCents(100, 'USD'), '$1.00');
    assert.equal(formatCents(4_99, 'USD'), '$4.99');
  });

  it('其它 currency 直接前缀', () => {
    assert.equal(formatCents(100, 'EUR'), 'EUR 1.00');
    assert.equal(formatCents(100, 'JPY'), 'JPY 1.00');
  });

  it('currency 为 null → 兜底回 CNY', () => {
    assert.equal(formatCents(100, null), '¥1.00');
  });

  it('负数也能格式化（退款场景）', () => {
    assert.equal(formatCents(-50), '¥-0.50');
  });

  it('浮点 cents 保留 2 位小数', () => {
    // 1.234 / 100 = 0.01234, toFixed(2) = "0.01"
    assert.equal(formatCents(1.234), '¥0.01');
  });
});
