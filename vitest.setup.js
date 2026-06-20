import { beforeEach, vi } from 'vitest';

// Map-backed localStorage shim — no DOM/jsdom required
const _store = new Map();

globalThis.localStorage = {
  getItem(key) {
    return _store.has(key) ? _store.get(key) : null;
  },
  setItem(key, value) {
    _store.set(key, String(value));
  },
  removeItem(key) {
    _store.delete(key);
  },
  clear() {
    _store.clear();
  },
};

beforeEach(() => {
  _store.clear();
  globalThis.fetch = vi.fn();
});
