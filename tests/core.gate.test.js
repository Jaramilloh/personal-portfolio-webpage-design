import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenBucketGate } from '../core.js';

describe('TokenBucketGate.tryConsume', () => {
  let gate;

  beforeEach(() => {
    vi.useFakeTimers();
    // Start at a fixed epoch so Date.now() is deterministic
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    gate = new TokenBucketGate({ capacity: 3, refillMs: 3000, storageKey: 'test.gate' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows consumption when tokens are available and returns correct shape', () => {
    const result = gate.tryConsume();
    expect(result.allowed).toBe(true);
    expect(result.retryInMs).toBe(0);
    // remaining is capacity - 1 = 2
    expect(result.remaining).toBe(2);
  });

  it('tokens refill proportionally after one refillMs has elapsed', () => {
    // Drain all 3 tokens
    gate.tryConsume();
    gate.tryConsume();
    gate.tryConsume();

    // Advance exactly one refillMs — should refill capacity (1 full period = capacity tokens)
    vi.advanceTimersByTime(3000);

    // After refill, we should get one more token (refill = 3000/3000 * 3 = 3, capped at 3)
    const result = gate.tryConsume();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 3 refilled - 1 consumed = 2
  });

  it('token count never exceeds capacity even when extra time passes', () => {
    // Drain all tokens first so we have a persisted state
    gate.tryConsume();
    gate.tryConsume();
    gate.tryConsume();

    // Advance 2x refillMs — should NOT accumulate beyond capacity
    vi.advanceTimersByTime(6000);

    const result = gate.tryConsume();
    expect(result.allowed).toBe(true);
    // remaining = capacity - 1 = 2 (capped at capacity before consuming)
    expect(result.remaining).toBe(2);
  });

  it('blocks when tokens are exhausted and returns retryInMs > 0', () => {
    // Drain all 3 tokens
    gate.tryConsume();
    gate.tryConsume();
    gate.tryConsume();

    const result = gate.tryConsume();
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // Math.ceil((need / capacity) * refillMs) = Math.ceil((1/3) * 3000) = 1000
    expect(result.retryInMs).toBe(1000);
  });
});
