import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeLlmCharge,
  displayToMicro,
  getPlanLabel,
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

    it('每个 model 都有 inputRate + cachedInputRate + outputRate（正数）', () => {
      for (const id of SUPPORTED_LLM_MODELS) {
        const rate = LLM_PRICING[id];
        assert.ok(rate, `${id} missing rate`);
        assert.ok(rate.inputRate > 0, `${id} inputRate should be > 0`);
        assert.ok(rate.outputRate > 0, `${id} outputRate should be > 0`);
        assert.ok(rate.cachedInputRate > 0, `${id} cachedInputRate should be > 0`);
        assert.ok(rate.cachedInputRate <= rate.inputRate, `${id} cachedInputRate should be ≤ inputRate`);
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

    it('cachedTokens=0 与省略参数等价（回归保护）', () => {
      assert.equal(computeLlmCharge('gpt-5.4', 1000, 500, 0), computeLlmCharge('gpt-5.4', 1000, 500));
    });

    it('gpt-5.4：cached 命中应严格便宜', () => {
      // fresh=200, cached=800, completion=500
      // cost = 200 × 0.25 + 800 × 0.025 + 500 × 1.5 = 50 + 20 + 750 = 820 显示 token
      // ceil(820 × 1.1 × 10_000) = 9_020_000 μ
      const withCache = computeLlmCharge('gpt-5.4', 1000, 500, 800);
      const withoutCache = computeLlmCharge('gpt-5.4', 1000, 500, 0);
      assert.equal(withCache, Math.ceil(820 * LLM_RATIO * TOKEN_PRECISION));
      assert.ok(withCache! < withoutCache!, 'cached 命中应该严格便宜');
    });

    it('cachedTokens > promptTokens 时 clamp 到 promptTokens', () => {
      // 全 prompt 命中 cache，等价于 cached=1000
      const clamped = computeLlmCharge('gpt-5.4', 1000, 500, 99_999);
      const allCached = computeLlmCharge('gpt-5.4', 1000, 500, 1000);
      assert.equal(clamped, allCached);
    });

    it('mimo cachedInputRate=inputRate 时，cached 不影响价格', () => {
      const a = computeLlmCharge('mimo-v2.5-pro', 1000, 200, 0);
      const b = computeLlmCharge('mimo-v2.5-pro', 1000, 200, 800);
      assert.equal(a, b);
    });
  });

  describe('getPlanLabel', () => {
    it('已知档位返回中文', () => {
      assert.equal(getPlanLabel('free'), '免费版');
      assert.equal(getPlanLabel('pro'), 'Pro 会员');
      assert.equal(getPlanLabel('max'), 'Max 会员');
    });

    it('null / undefined / 空串 → 兜底「免费版」', () => {
      assert.equal(getPlanLabel(null), '免费版');
      assert.equal(getPlanLabel(undefined), '免费版');
      assert.equal(getPlanLabel(''), '免费版');
    });

    it('未知 plan → 原样返回（避免误降级到免费版）', () => {
      assert.equal(getPlanLabel('enterprise'), 'enterprise');
      assert.equal(getPlanLabel('lifetime'), 'lifetime');
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
