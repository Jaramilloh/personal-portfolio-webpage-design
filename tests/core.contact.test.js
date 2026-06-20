import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalOutboxChannel } from '../core.js';

describe('LocalOutboxChannel.send', () => {
  let channel;

  beforeEach(() => {
    channel = new LocalOutboxChannel('test.outbox');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns {ok: true, ref} with ref matching /^MSG-/', async () => {
    const result = await channel.send({ to: 'test@example.com', body: 'Hello' });
    expect(result.ok).toBe(true);
    expect(typeof result.ref).toBe('string');
    expect(result.ref).toMatch(/^MSG-/);
  });

  it('appends the sent payload to the outbox in localStorage', async () => {
    const payload = { to: 'user@example.com', body: 'Test message' };
    await channel.send(payload);

    const stored = JSON.parse(globalThis.localStorage.getItem('test.outbox'));
    expect(stored).toHaveLength(1);
    expect(stored[0].to).toBe(payload.to);
    expect(stored[0].body).toBe(payload.body);
    expect(stored[0].ref).toMatch(/^MSG-/);
    expect(stored[0].at).toBeDefined();
  });

  it('uses deterministic ref when Math.random is spied', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);

    const result = await channel.send({ body: 'deterministic' });

    // Math.random() = 0.123456 → (0.123456).toString(36) = '0.4fzyo82mvyr'
    // slice(2,8) = '4fzyo8', toUpperCase() = '4FZYO8'
    // ref = 'MSG-4FZYO8'
    expect(result.ref).toBe('MSG-4FZYO8');
  });

  it('second send() appends (outbox length becomes 2, not 1)', async () => {
    await channel.send({ body: 'first' });
    await channel.send({ body: 'second' });

    const stored = JSON.parse(globalThis.localStorage.getItem('test.outbox'));
    expect(stored).toHaveLength(2);
    expect(stored[0].body).toBe('first');
    expect(stored[1].body).toBe('second');
  });
});
