import { describe, it, expect, beforeEach } from 'vitest';
import { buildPortfolioCore } from '../core.js';

describe('buildPortfolioCore — port shape smoke', () => {
  let core;

  beforeEach(() => {
    core = buildPortfolioCore({});
  });

  it('returns an object with all expected port keys', () => {
    expect(core).toHaveProperty('repositories');
    expect(core).toHaveProperty('media');
    expect(core).toHaveProperty('cvGate');
    expect(core).toHaveProperty('contact');
    expect(core).toHaveProperty('modules');
  });

  it('exposes pure input-hardening helpers (sanitizeText, safeHttpUrl, limits)', () => {
    expect(typeof core.sanitizeText).toBe('function');
    expect(typeof core.safeHttpUrl).toBe('function');
    expect(core.limits).toMatchObject({ name: 120, email: 254, message: 4000 });
    // wired through to the real implementations
    expect(core.sanitizeText('  hi\n ', 100)).toBe('hi');
    expect(core.safeHttpUrl('javascript:alert(1)')).toBe('');
    expect(core.safeHttpUrl('https://github.com/x')).toBe('https://github.com/x');
  });

  it('repositories has a list function', () => {
    expect(typeof core.repositories.list).toBe('function');
  });

  it('cvGate has a tryConsume function', () => {
    expect(typeof core.cvGate.tryConsume).toBe('function');
  });

  it('contact has a send function', () => {
    expect(typeof core.contact.send).toBe('function');
  });

  it('media has a list function', () => {
    expect(typeof core.media.list).toBe('function');
  });

  it('modules is an Array with length >= 1 and each item has id, label, enabled', () => {
    expect(Array.isArray(core.modules)).toBe(true);
    expect(core.modules.length).toBeGreaterThanOrEqual(1);
    for (const mod of core.modules) {
      expect(mod).toHaveProperty('id');
      expect(mod).toHaveProperty('label');
      expect(mod).toHaveProperty('enabled');
    }
  });
});
