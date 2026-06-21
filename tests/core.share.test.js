// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { QrShareAdapter } from '../assets/qr-share-adapter.js';

describe('QrShareAdapter — delegation behavior', () => {
  function makeApi() {
    return {
      init:   vi.fn(),
      open:   vi.fn(),
      close:  vi.fn(),
      toggle: vi.fn(),
    };
  }

  it('mount delegates to api.init with the exact payload', () => {
    const api = makeApi();
    const adapter = new QrShareAdapter(api);
    adapter.mount({ url: 'https://example.com', name: 'Alice', role: 'Engineer' });
    expect(api.init).toHaveBeenCalledOnce();
    expect(api.init).toHaveBeenCalledWith({ url: 'https://example.com', name: 'Alice', role: 'Engineer' });
  });

  it('open delegates to api.open once', () => {
    const api = makeApi();
    const adapter = new QrShareAdapter(api);
    adapter.open();
    expect(api.open).toHaveBeenCalledOnce();
  });

  it('close delegates to api.close once', () => {
    const api = makeApi();
    const adapter = new QrShareAdapter(api);
    adapter.close();
    expect(api.close).toHaveBeenCalledOnce();
  });

  it('toggle delegates to api.toggle once', () => {
    const api = makeApi();
    const adapter = new QrShareAdapter(api);
    adapter.toggle();
    expect(api.toggle).toHaveBeenCalledOnce();
  });

  it('null api — mount does not throw', () => {
    const adapter = new QrShareAdapter(null);
    expect(() => adapter.mount({ url: 'x', name: 'y', role: 'z' })).not.toThrow();
  });

  it('null api — open does not throw', () => {
    const adapter = new QrShareAdapter(null);
    expect(() => adapter.open()).not.toThrow();
  });

  it('null api — close does not throw', () => {
    const adapter = new QrShareAdapter(null);
    expect(() => adapter.close()).not.toThrow();
  });

  it('null api — toggle does not throw', () => {
    const adapter = new QrShareAdapter(null);
    expect(() => adapter.toggle()).not.toThrow();
  });

  it('constructor default falls back to globalThis.QRShare (undefined in node — no throw on open)', () => {
    // In node, globalThis.QRShare is undefined; optional chaining means no throw
    const adapter = new QrShareAdapter();
    expect(() => adapter.open()).not.toThrow();
    expect(() => adapter.close()).not.toThrow();
    expect(() => adapter.toggle()).not.toThrow();
    expect(() => adapter.mount({})).not.toThrow();
  });

  it('mount with different payload — triangulation: only name provided', () => {
    const api = makeApi();
    const adapter = new QrShareAdapter(api);
    adapter.mount({ url: 'https://foo.bar', name: 'Bob', role: 'Designer' });
    expect(api.init).toHaveBeenCalledWith({ url: 'https://foo.bar', name: 'Bob', role: 'Designer' });
    expect(api.init).toHaveBeenCalledOnce();
  });
});
