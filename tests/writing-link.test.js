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

  it('marks the entry published as the first card', () => {
    const linkIdx = blog.indexOf('href="writing/protocolo.html"');
    expect(linkIdx).toBeGreaterThan(-1);
    // Protocolo is the first card — it precedes every other note card in the grid.
    expect(blog.indexOf('href="writing/lytro-lightfield.html"')).toBeGreaterThan(linkIdx);
    expect(blog).toContain('publicado · ~30 min · 9 etapas');
  });

  it('leaves no draft cards in the writing grid', () => {
    // Publishing the ablation note retired the last Draft card.
    expect((blog.match(/>Draft</g) || []).length).toBe(0);
  });
});

describe('section 09 — published Lytro note', () => {
  it('ships the self-contained note asset under writing/', () => {
    const asset = join(root, 'writing', 'lytro-lightfield.html');
    expect(existsSync(asset)).toBe(true);
    expect(statSync(asset).size).toBeGreaterThan(8_000);
  });

  it('turns the third card into a live link to the note', () => {
    expect(blog).toContain('href="writing/lytro-lightfield.html"');
    expect(blog).toContain('From Lytro raw to sub-aperture light-field stacks');
  });

  it('opens the note in a new tab without leaking the opener', () => {
    const anchor = blog.slice(blog.indexOf('href="writing/lytro-lightfield.html"'));
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener"');
  });

  it('marks the entry published with correct metadata', () => {
    expect(blog).toContain('publicado · ~10 min · 6 secciones');
  });

  it('Lytro card appears after Protocolo card', () => {
    const protocoloIdx = blog.indexOf('href="writing/protocolo.html"');
    const lytroIdx = blog.indexOf('href="writing/lytro-lightfield.html"');
    expect(protocoloIdx).toBeGreaterThan(-1);
    expect(lytroIdx).toBeGreaterThan(protocoloIdx);
  });

  it('note source contains i18n wiring', () => {
    const content = readFileSync(join(root, 'writing', 'lytro-lightfield.html'), 'utf8');
    expect(content).toContain('lytro-lang');
    expect(content).toContain('10×10');
  });
});

describe('section 09 — published ablation note', () => {
  it('ships the self-contained note asset under writing/', () => {
    const asset = join(root, 'writing', 'ablation-driven-detector.html');
    expect(existsSync(asset)).toBe(true);
    expect(statSync(asset).size).toBeGreaterThan(8_000);
  });

  it('turns the former draft card into a live link to the note', () => {
    expect(blog).toContain('href="writing/ablation-driven-detector.html"');
    expect(blog).toContain('Shrinking a detector 61% with ablation-driven design');
  });

  it('opens the note in a new tab without leaking the opener', () => {
    const anchor = blog.slice(blog.indexOf('href="writing/ablation-driven-detector.html"'));
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener"');
  });

  it('marks the entry published with correct metadata', () => {
    expect(blog).toContain('publicado · ~6 min · 6 secciones');
  });

  it('ablation card sits between Protocolo and Lytro cards', () => {
    const protocoloIdx = blog.indexOf('href="writing/protocolo.html"');
    const ablationIdx = blog.indexOf('href="writing/ablation-driven-detector.html"');
    const lytroIdx = blog.indexOf('href="writing/lytro-lightfield.html"');
    expect(ablationIdx).toBeGreaterThan(protocoloIdx);
    expect(lytroIdx).toBeGreaterThan(ablationIdx);
  });

  it('note source contains i18n wiring', () => {
    const content = readFileSync(join(root, 'writing', 'ablation-driven-detector.html'), 'utf8');
    expect(content).toContain('ablation-lang');
    expect(content).toContain('61.46');
  });
});
