import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Section 09 ("Writing") is static inline HTML inside <section id="blog"> of the
// dc-runtime entry file — no adapter renders it — so reading the file is enough
// to assert the published wire-in deterministically (node env, no browser).
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'Juan Felipe Jaramillo.dc.html'), 'utf8');

const blogStart = html.indexOf('<section id="blog"');
const blog = html.slice(blogStart, html.indexOf('</section>', blogStart));

describe('section 09 — published Protocolo guide', () => {
  it('ships the self-contained guide asset under writing/', () => {
    const asset = join(root, 'writing', 'protocolo.html');
    expect(existsSync(asset)).toBe(true);
    // The guide is a fully-inlined, self-contained document — never an empty stub.
    expect(statSync(asset).size).toBeGreaterThan(100_000);
  });

  it('turns the first card into a live link to the guide', () => {
    expect(blog).toContain('href="writing/protocolo.html"');
    expect(blog).toContain('Armá tu entorno de desarrollo con IA — Windows + WSL2');
  });

  it('opens the guide in a new tab without leaking the opener', () => {
    const anchor = blog.slice(blog.indexOf('href="writing/protocolo.html"'));
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener"');
  });

  it('marks the entry published, not a draft, as the first card', () => {
    const linkIdx = blog.indexOf('href="writing/protocolo.html"');
    const firstDraftIdx = blog.indexOf('>Draft<');
    expect(linkIdx).toBeGreaterThan(-1);
    // The live anchor must precede the remaining Draft cards (i.e. it IS the first card).
    expect(firstDraftIdx).toBeGreaterThan(linkIdx);
    expect(blog).toContain('publicado · ~30 min · 9 etapas');
  });

  it('leaves the other two draft cards untouched', () => {
    expect(blog).toContain('Shrinking a detector 61% with ablation-driven design');
    expect(blog).toContain('From Lytro raw to sub-aperture light-field stacks');
    expect((blog.match(/>Draft</g) || []).length).toBe(2);
  });
});
