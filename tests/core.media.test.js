import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StaticManifestMediaAdapter, GooglePhotosAdapter, buildPortfolioCore } from '../core.js';

// ── StaticManifestMediaAdapter ────────────────────────────────────────────────

describe('StaticManifestMediaAdapter.list — live scenario', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns mapped items and source:live when manifest has entries', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ url: 'a.jpg', width: 800, height: 600 }] }),
    });
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result).toEqual({
      items: [{ url: 'a.jpg', width: 800, height: 600, alt: 'Photo', date: '' }],
      source: 'live',
    });
  });

  it('passes through explicit alt and date values from manifest entry', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ url: 'b.jpg', width: 400, height: 300, alt: 'Sunrise', date: '2024-06-01' }],
      }),
    });
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result.items[0].alt).toBe('Sunrise');
    expect(result.items[0].date).toBe('2024-06-01');
    expect(result.source).toBe('live');
  });
});

// ── Empty scenarios ───────────────────────────────────────────────────────────

describe('StaticManifestMediaAdapter.list — empty scenarios', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns source:empty when manifest has empty items array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result).toEqual({ items: [], source: 'empty' });
  });

  it('returns source:empty when manifest has no items key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result).toEqual({ items: [], source: 'empty' });
  });

  it('returns source:empty when no manifest URL is provided', async () => {
    const adapter = new StaticManifestMediaAdapter('');

    const result = await adapter.list();

    expect(result).toEqual({ items: [], source: 'empty' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── Error scenarios ───────────────────────────────────────────────────────────

describe('StaticManifestMediaAdapter.list — error scenarios', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns source:error with reason when fetch returns non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result.source).toBe('error');
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.items).toEqual([]);
  });

  it('returns source:error and does not throw when fetch rejects (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result.source).toBe('error');
    expect(result.reason).toContain('Failed to fetch');
    expect(result.items).toEqual([]);
  });

  it('returns source:error and does not throw when json() throws (malformed JSON)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result.source).toBe('error');
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.items).toEqual([]);
  });
});

// ── Field defaults ────────────────────────────────────────────────────────────

describe('StaticManifestMediaAdapter.list — field defaults', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults alt to "Photo" and date to "" when absent in entry', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ url: 'c.jpg', width: 1024, height: 768 }] }),
    });
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result.items[0].alt).toBe('Photo');
    expect(result.items[0].date).toBe('');
  });

  it('passes through explicit alt and date without overriding defaults', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ url: 'd.jpg', width: 1920, height: 1080, alt: 'Mountains', date: '2025-01-15' }],
      }),
    });
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const result = await adapter.list();

    expect(result.items[0].alt).toBe('Mountains');
    expect(result.items[0].date).toBe('2025-01-15');
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('StaticManifestMediaAdapter.list — determinism', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns identical items in identical order on two consecutive calls', async () => {
    const items = [
      { url: 'x.jpg', width: 800, height: 600 },
      { url: 'y.jpg', width: 1200, height: 900 },
      { url: 'z.jpg', width: 640, height: 480 },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items }),
    }));
    const adapter = new StaticManifestMediaAdapter('https://example.com/photos.json');

    const first = await adapter.list();
    const second = await adapter.list();

    expect(first.items).toEqual(second.items);
    expect(first.source).toBe(second.source);
  });
});

// ── Composition root ──────────────────────────────────────────────────────────

describe('buildPortfolioCore — composition root', () => {
  it('wires core.media to StaticManifestMediaAdapter', () => {
    const core = buildPortfolioCore({});

    expect(core.media).toBeInstanceOf(StaticManifestMediaAdapter);
  });

  it('still exports GooglePhotosAdapter (not removed)', () => {
    expect(GooglePhotosAdapter).toBeDefined();
    const adapter = new GooglePhotosAdapter('https://example.com/api');
    expect(adapter).toBeInstanceOf(GooglePhotosAdapter);
  });
});
