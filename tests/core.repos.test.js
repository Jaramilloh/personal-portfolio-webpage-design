import { describe, it, expect, vi } from 'vitest';
import {
  ResilientRepositoryService,
  CuratedRepositoryAdapter,
} from '../core.js';

// ── ResilientRepositoryService ────────────────────────────────────────────────

describe('ResilientRepositoryService.list', () => {
  const fakeRepo = {
    name: 'test-repo',
    desc: 'A test repo',
    url: 'https://github.com/test/test-repo',
    language: 'JavaScript',
    stars: 10,
    forks: 2,
    topics: ['test'],
    updated: '2024-01-01T00:00:00Z',
  };

  const primaryResult = { items: [fakeRepo], source: 'live' };

  it('returns primary result when primary resolves a non-empty list', async () => {
    const primary = { list: vi.fn().mockResolvedValue(primaryResult) };
    const fallback = { list: vi.fn() };
    const svc = new ResilientRepositoryService(primary, fallback);

    const result = await svc.list();

    expect(result).toEqual(primaryResult);
    expect(fallback.list).not.toHaveBeenCalled();
  });

  it('falls back when primary resolves an empty items array', async () => {
    const fallbackResult = { items: [fakeRepo], source: 'fallback' };
    const primary = { list: vi.fn().mockResolvedValue({ items: [], source: 'live' }) };
    const fallback = { list: vi.fn().mockResolvedValue(fallbackResult) };
    const svc = new ResilientRepositoryService(primary, fallback);

    const result = await svc.list();

    expect(result.source).toBe('fallback');
    // core.js throws new Error('empty') on empty list; reason = e.message = 'empty'
    expect(result.reason).toBe('empty');
    expect(fallback.list).toHaveBeenCalledOnce();
  });

  it('falls back when primary throws and result has source:fallback and reason', async () => {
    const fallbackResult = { items: [fakeRepo], source: 'fallback' };
    const primary = { list: vi.fn().mockRejectedValue(new Error('network error')) };
    const fallback = { list: vi.fn().mockResolvedValue(fallbackResult) };
    const svc = new ResilientRepositoryService(primary, fallback);

    const result = await svc.list();

    expect(result.source).toBe('fallback');
    expect(typeof result.reason).toBe('string');
    expect(result.reason).toContain('network error');
    expect(result.items).toEqual([fakeRepo]);
  });
});

// ── CuratedRepositoryAdapter ─────────────────────────────────────────────────

describe('CuratedRepositoryAdapter.list', () => {
  it('returns items with the correct port contract shape', async () => {
    const seedItem = {
      name: 'my-project',
      desc: 'A curated project',
      url: 'https://github.com/user/my-project',
      language: 'TypeScript',
      stars: 5,
      forks: 1,
      topics: ['portfolio'],
      updated: '2024-06-01T00:00:00Z',
    };
    const adapter = new CuratedRepositoryAdapter([seedItem]);

    const result = await adapter.list();

    expect(result.source).toBe('fallback');
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(1);

    // Adapter passes seed through unchanged; toStrictEqual catches added/removed fields
    expect(result.items[0]).toStrictEqual(seedItem);
  });

  it('returns source:fallback even for empty seed', async () => {
    const adapter = new CuratedRepositoryAdapter([]);
    const result = await adapter.list();
    expect(result.source).toBe('fallback');
    expect(result.items).toEqual([]);
  });
});
