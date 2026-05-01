import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeLlmCharge, insufficientBalanceError, LLM_RATIO } from '../src/pricing.ts';

describe('Pricing', () => {
  describe('computeLlmCharge', () => {
    it('should compute charge based on prompt and completion tokens with ratio', () => {
      const charge = computeLlmCharge(100, 50);
      assert.equal(charge, Math.ceil(150 * LLM_RATIO));
    });

    it('should handle zero tokens', () => {
      const charge = computeLlmCharge(0, 0);
      assert.equal(charge, 0);
    });

    it('should ceil the fractional tokens', () => {
      const charge = computeLlmCharge(1, 0);
      assert.equal(charge, Math.ceil(1.1)); // 2
    });
  });

  describe('insufficientBalanceError', () => {
    it('should return OpenAI compatible error format', () => {
      const err = insufficientBalanceError(100);
      assert.equal(err.error.type, 'insufficient_balance');
      assert.equal(err.error.code, 'insufficient_balance');
      assert.ok(err.error.message.includes('100 tokens'));
    });
  });
});
