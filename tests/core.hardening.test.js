import { describe, it, expect } from 'vitest';
import { sanitizeText, safeHttpUrl, INPUT_LIMITS } from '../core.js';

describe('INPUT_LIMITS', () => {
  it('exposes frozen caps for name, email, and message', () => {
    expect(INPUT_LIMITS.name).toBe(120);
    expect(INPUT_LIMITS.email).toBe(254);
    expect(INPUT_LIMITS.message).toBe(4000);
    expect(Object.isFrozen(INPUT_LIMITS)).toBe(true);
  });
});

describe('sanitizeText', () => {
  it('coerces nullish input to empty string', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('strips control chars including newlines and tabs by default (single-line)', () => {
    expect(sanitizeText('a\nb\tc\rd')).toBe('abcd');
  });

  it('strips NUL and other C0 control characters', () => {
    expect(sanitizeText('a\x00b\x07c\x1fd')).toBe('abcd');
  });

  it('strips C1 control characters (\\x7F-\\x9F)', () => {
    expect(sanitizeText('a\x7Fb\x85c\x9Fd')).toBe('abcd');
  });

  it('keeps newlines and tabs when allowNewlines is true', () => {
    expect(sanitizeText('a\nb\tc', INPUT_LIMITS.message, { allowNewlines: true })).toBe('a\nb\tc');
  });

  it('still strips non-newline control chars even when allowNewlines is true', () => {
    expect(sanitizeText('a\x00b\nc', INPUT_LIMITS.message, { allowNewlines: true })).toBe('ab\nc');
  });

  it('hard-caps the length at maxLength', () => {
    const out = sanitizeText('x'.repeat(500), 10);
    expect(out).toBe('xxxxxxxxxx');
    expect(out.length).toBe(10);
  });

  it('does not truncate input shorter than the cap', () => {
    expect(sanitizeText('short', 100)).toBe('short');
  });

  it('coerces non-string values to string before sanitizing', () => {
    expect(sanitizeText(42)).toBe('42');
  });
});

describe('safeHttpUrl', () => {
  it('allows absolute https URLs unchanged', () => {
    expect(safeHttpUrl('https://github.com/Jaramilloh')).toBe('https://github.com/Jaramilloh');
  });

  it('allows absolute http URLs unchanged', () => {
    expect(safeHttpUrl('http://example.com/path?q=1')).toBe('http://example.com/path?q=1');
  });

  it('allows relative paths', () => {
    expect(safeHttpUrl('./cv/Juan-Felipe-Jaramillo-CV.pdf')).toBe('./cv/Juan-Felipe-Jaramillo-CV.pdf');
    expect(safeHttpUrl('assets/album/img-01.webp')).toBe('assets/album/img-01.webp');
    expect(safeHttpUrl('/absolute/path')).toBe('/absolute/path');
  });

  it('allows protocol-relative URLs', () => {
    expect(safeHttpUrl('//cdn.example.com/x.png')).toBe('//cdn.example.com/x.png');
  });

  it('allows anchor links', () => {
    expect(safeHttpUrl('#cv')).toBe('#cv');
  });

  it('rejects javascript: scheme', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBe('');
  });

  it('rejects javascript: scheme regardless of case', () => {
    expect(safeHttpUrl('JaVaScRiPt:alert(1)')).toBe('');
  });

  it('rejects javascript: scheme with embedded control chars (tab/newline evasion)', () => {
    expect(safeHttpUrl('java\tscript:alert(1)')).toBe('');
    expect(safeHttpUrl('java\nscript:alert(1)')).toBe('');
  });

  it('rejects data: scheme', () => {
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('rejects vbscript: and other non-http schemes', () => {
    expect(safeHttpUrl('vbscript:msgbox(1)')).toBe('');
    expect(safeHttpUrl('file:///etc/passwd')).toBe('');
    expect(safeHttpUrl('ftp://example.com')).toBe('');
  });

  it('returns empty string for nullish or blank input', () => {
    expect(safeHttpUrl(null)).toBe('');
    expect(safeHttpUrl(undefined)).toBe('');
    expect(safeHttpUrl('')).toBe('');
    expect(safeHttpUrl('   ')).toBe('');
  });
});
