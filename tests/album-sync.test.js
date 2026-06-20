import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  sampleImages,
  extractMetadata,
  optimizeImage,
  buildManifest,
  planCleanup,
  computeBudget,
} from '../tools/album-sync.mjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures/album-sync');

// ── mulberry32 ────────────────────────────────────────────────────────────────

describe('mulberry32', () => {
  it('produces same sequence on two invocations with same seed', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const seq1 = Array.from({ length: 5 }, mulberry32(1));
    const seq2 = Array.from({ length: 5 }, mulberry32(2));
    expect(seq1).not.toEqual(seq2);
  });
});

// ── sampleImages ──────────────────────────────────────────────────────────────

describe('sampleImages', () => {
  const pool20 = Array.from({ length: 20 }, (_, i) => `img-${i + 1}.jpg`);
  const pool3 = ['a.jpg', 'b.jpg', 'c.jpg'];

  it('seed → same subset twice (deterministic)', () => {
    const first = sampleImages(pool20, 6, 42);
    const second = sampleImages(pool20, 6, 42);
    expect(first).toEqual(second);
  });

  it('count > pool → all items returned, no error', () => {
    const result = sampleImages(pool3, 8);
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual(pool3.sort());
  });

  it('count < pool → exactly N distinct items', () => {
    const result = sampleImages(pool20, 6, 7);
    expect(result).toHaveLength(6);
    // All items are from the pool
    result.forEach(item => expect(pool20).toContain(item));
    // No duplicates
    expect(new Set(result).size).toBe(6);
  });

  it('no seed → function returns without throwing (non-determinism not asserted)', () => {
    expect(() => sampleImages(pool20, 5)).not.toThrow();
    const result = sampleImages(pool20, 5);
    expect(result).toHaveLength(5);
  });

  it('count=1, pool=[one item] → that single item returned', () => {
    const result = sampleImages(['only.jpg'], 1, 0);
    expect(result).toEqual(['only.jpg']);
  });
});

// ── extractMetadata ───────────────────────────────────────────────────────────

describe('extractMetadata', () => {
  it('sidecar with description + timestamp → alt=Sunset, date is ISO string from ts 1700000000', () => {
    const sidecar = JSON.parse(readFileSync(join(FIXTURES, 'sidecar.json'), 'utf8'));
    const { alt, date } = extractMetadata({ sidecar });
    expect(alt).toBe('Sunset');
    expect(date).toBe('2023-11-14');
  });

  it('sidecar with timestamp only (no description) → alt=Photo, date populated', () => {
    const sidecar = JSON.parse(readFileSync(join(FIXTURES, 'sidecar-partial.json'), 'utf8'));
    const { alt, date } = extractMetadata({ sidecar });
    expect(alt).toBe('Photo');
    expect(date).toBe('2023-11-14');
  });

  it('no sidecar, no exif → alt=Photo, date=""', () => {
    const { alt, date } = extractMetadata({});
    expect(alt).toBe('Photo');
    expect(date).toBe('');
  });

  it('no sidecar, exif object with DateTimeOriginal → date derived from exif', () => {
    const exif = { DateTimeOriginal: new Date('2022-05-10T12:00:00Z') };
    const { alt, date } = extractMetadata({ exif });
    expect(alt).toBe('Photo');
    expect(date).toBe('2022-05-10');
  });

  it('sidecar present but both fields absent → defaults', () => {
    const { alt, date } = extractMetadata({ sidecar: {} });
    expect(alt).toBe('Photo');
    expect(date).toBe('');
  });
});

// ── optimizeImage ─────────────────────────────────────────────────────────────

describe('optimizeImage', () => {
  it('given tiny.jpg fixture buffer, output is WebP, dimensions returned, both ≤ maxEdge', async () => {
    const input = readFileSync(join(FIXTURES, 'tiny.jpg'));
    const { data, width, height } = await optimizeImage(input, { maxEdge: 1600 });
    expect(data).toBeInstanceOf(Buffer);
    expect(width).toBeLessThanOrEqual(1600);
    expect(height).toBeLessThanOrEqual(1600);
    // Verify it is a valid WebP by checking with sharp
    const meta = await sharp(data).metadata();
    expect(meta.format).toBe('webp');
  });

  it('given 3200×2400 image, output width=1600, height=1200', async () => {
    const input = await sharp({
      create: { width: 3200, height: 2400, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .jpeg()
      .toBuffer();
    const { width, height } = await optimizeImage(input, { maxEdge: 1600 });
    expect(width).toBe(1600);
    expect(height).toBe(1200);
  });

  it('image already within 1600px (10×10), output dimensions unchanged', async () => {
    const input = readFileSync(join(FIXTURES, 'tiny.jpg'));
    const { width, height } = await optimizeImage(input, { maxEdge: 1600 });
    expect(width).toBe(10);
    expect(height).toBe(10);
  });

  it('output data.length ≤ maxBytes for a quality-reduceable image', async () => {
    // Create a larger synthetic image that can be compressed
    const input = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
    const { data } = await optimizeImage(input, { maxEdge: 1600, maxBytes: 256000 });
    expect(data.length).toBeLessThanOrEqual(256000);
  });
});

// ── computeBudget ─────────────────────────────────────────────────────────────

describe('computeBudget', () => {
  it('undefined megapixels → floor (256000)', () => {
    expect(computeBudget(undefined)).toBe(256000);
  });

  it('small image below floor → clamped up to floor', () => {
    // 1 MP * 60000 = 60000 < 256000 floor
    expect(computeBudget(1)).toBe(256000);
  });

  it('16 MP camera source → budget scales above the floor', () => {
    // 16 MP * 60000 = 960000
    const budget = computeBudget(16);
    expect(budget).toBe(16 * 60000);
    expect(budget).toBeGreaterThan(256000);
    expect(budget).toBeLessThan(1500000);
  });

  it('huge megapixel count → clamped down to ceiling (1500000)', () => {
    // 40 MP * 60000 = 2.4 MB, capped
    expect(computeBudget(40)).toBe(1500000);
  });

  it('custom floor / perMegapixel / ceiling respected', () => {
    expect(
      computeBudget(20, { floor: 100_000, perMegapixel: 60_000, ceiling: 900_000 })
    ).toBe(900_000);
    expect(
      computeBudget(10, { floor: 100_000, perMegapixel: 60_000, ceiling: 900_000 })
    ).toBe(600_000);
  });
});

// ── buildManifest ─────────────────────────────────────────────────────────────

describe('buildManifest', () => {
  it('3 entries → {items: [...3 objects]}, each with exactly {url, width, height, alt, date}', () => {
    const entries = [
      { filename: 'gp-01.webp', width: 1600, height: 1200, alt: 'Sunset', date: '2023-11-14' },
      { filename: 'gp-02.webp', width: 800, height: 600, alt: 'Beach', date: '2023-06-01' },
      { filename: 'gp-03.webp', width: 1024, height: 768, alt: 'Mountain', date: '' },
    ];
    const manifest = buildManifest(entries);
    expect(manifest.items).toHaveLength(3);
    manifest.items.forEach(item => {
      expect(Object.keys(item).sort()).toEqual(['alt', 'date', 'height', 'url', 'width']);
    });
  });

  it('url = assets/album/${filename} (no leading slash)', () => {
    const entries = [{ filename: 'gp-02.webp', width: 800, height: 600, alt: 'Test', date: '' }];
    const { items } = buildManifest(entries);
    expect(items[0].url).toBe('assets/album/gp-02.webp');
  });

  it('entry with no alt → defaults to Photo; no date → defaults to ""', () => {
    const entries = [{ filename: 'gp-01.webp', width: 100, height: 100 }];
    const { items } = buildManifest(entries);
    expect(items[0].alt).toBe('Photo');
    expect(items[0].date).toBe('');
  });

  it('empty entries → {items: []}', () => {
    expect(buildManifest([])).toEqual({ items: [] });
  });
});

// ── planCleanup ───────────────────────────────────────────────────────────────

describe('planCleanup', () => {
  it('mixed files → removable = only gp-*.webp + photos.json', () => {
    const existing = ['gp-01.webp', 'gp-02.webp', 'photos.json', 'README.md', 'hand-photo.jpg'];
    const { removable } = planCleanup(existing);
    expect(removable.sort()).toEqual(['gp-01.webp', 'gp-02.webp', 'photos.json'].sort());
  });

  it('README.md alone → removable = []', () => {
    expect(planCleanup(['README.md']).removable).toEqual([]);
  });

  it('empty array → removable = []', () => {
    expect(planCleanup([]).removable).toEqual([]);
  });

  it('gp-01.webp alone → removable = [gp-01.webp]', () => {
    expect(planCleanup(['gp-01.webp']).removable).toEqual(['gp-01.webp']);
  });
});
