import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeLlmCharge,
  displayToMicro,
  insufficientBalanceError,
  isSupportedLlmModel,
  LLM_PRICING,
  LLM_RATIO,
  microToDisplay,
  SUPPORTED_LLM_MODELS,
  TOKEN_PRECISION,
} from '../src/pricing.ts';

describe('Pricing', () => {
  describe('precision helpers', () => {
    it('TOKEN_PRECISION = 10_000', () => {
      assert.equal(TOKEN_PRECISION, 10_000);
    });

    it('displayToMicro / microToDisplay round-trip', () => {
      assert.equal(displayToMicro(1), 10_000);
      assert.equal(displayToMicro(0), 0);
      assert.equal(displayToMicro(0.5), 5_000);
      assert.equal(microToDisplay(15_000), 1.5);
      assert.equal(microToDisplay(0), 0);
    });

    it('displayToMicro rounds浮点误差', () => {
      // 0.1 + 0.2 = 0.30000000000000004，displayToMicro 必须 round 到 3000
      assert.equal(displayToMicro(0.1 + 0.2), 3000);
    });
  });

  describe('LLM_PRICING table', () => {
    it('包含 4 个支持的 model', () => {
      assert.deepEqual(new Set(SUPPORTED_LLM_MODELS), new Set(['gpt-5.5', 'gpt-5.4', 'mimo-v2.5-pro', 'mimo-v2.5']));
    });

    it('每个 model 都有 inputRate + outputRate（正数）', () => {
      for (const id of SUPPORTED_LLM_MODELS) {
        const rate = LLM_PRICING[id];
        assert.ok(rate, `${id} missing rate`);
        assert.ok(rate.inputRate > 0, `${id} inputRate should be > 0`);
        assert.ok(rate.outputRate > 0, `${id} outputRate should be > 0`);
      }
    });

    it('isSupportedLlmModel 正/负样本', () => {
      assert.equal(isSupportedLlmModel('gpt-5.4'), true);
      assert.equal(isSupportedLlmModel('mimo-v2.5'), true);
      assert.equal(isSupportedLlmModel('gpt-4o-mini'), false);
      assert.equal(isSupportedLlmModel(''), false);
    });
  });

  describe('computeLlmCharge', () => {
    it('gpt-5.4：1k input + 1k output', () => {
      // (1000 × 0.25 + 1000 × 1.5) × 1.1 × 10_000 = 1750 × 1.1 × 10_000 = 19_250_000
      const cost = computeLlmCharge('gpt-5.4', 1000, 1000);
      assert.equal(cost, Math.ceil(1750 * LLM_RATIO * TOKEN_PRECISION));
    });

    it('gpt-5.5：纯 input', () => {
      // 1000 × 0.5 × 1.1 × 10_000 = 5_500_000
      const cost = computeLlmCharge('gpt-5.5', 1000, 0);
      assert.equal(cost, Math.ceil(500 * LLM_RATIO * TOKEN_PRECISION));
    });

    it('mimo-v2.5-pro：input + output 不对称', () => {
      // 100 × 0.02 + 200 × 0.3 = 2 + 60 = 62 显示 token
      // ceil(62 × 1.1 × 10_000) = ceil(682_000) = 682_000 μ
      const cost = computeLlmCharge('mimo-v2.5-pro', 100, 200);
      assert.equal(cost, 682_000);
    });

    it('mimo-v2.5：极廉价输入精度被保留（μ 级别 ceil）', () => {
      // 1 input × 0.008 = 0.008 显示 token
      // ceil(0.008 × 1.1 × 10_000) = ceil(88) = 88 μ
      // 旧公式（整数 ceil 显示 token）：ceil(0.008 × 1.1) = 1 显示 token = 10_000 μ，溢扣 113×
      const cost = computeLlmCharge('mimo-v2.5', 1, 0);
      assert.equal(cost, 88);
    });

    it('0 + 0 → 0', () => {
      assert.equal(computeLlmCharge('gpt-5.4', 0, 0), 0);
    });

    it('未知 model → null', () => {
      assert.equal(computeLlmCharge('gpt-4o-mini', 100, 100), null);
      assert.equal(computeLlmCharge('', 100, 100), null);
    });
  });

  describe('insufficientBalanceError', () => {
    it('入参是 μtoken，文案里展示 display token', () => {
      // 100_000 μ = 10 display tokens
      const err = insufficientBalanceError(100_000);
      assert.equal(err.error.type, 'insufficient_balance');
      assert.equal(err.error.code, 'insufficient_balance');
      assert.ok(err.error.message.includes('10 tokens'), `expected '10 tokens' in message: ${err.error.message}`);
    });

    it('小数余额按显示 token 输出（toLocaleString）', () => {
      // 5_000 μ = 0.5 display token
      const err = insufficientBalanceError(5_000);
      assert.ok(err.error.message.includes('0.5 tokens'), `expected '0.5 tokens' in message: ${err.error.message}`);
    });
  });
});
