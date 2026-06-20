/**
 * core.js — Hexagonal (ports & adapters) core for the portfolio domain.
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  ADAPTERS (IO, swappable)   →   PORTS (contracts)   →  DOMAIN │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * The DOMAIN (the page) depends ONLY on PORTS — abstract contracts.
 * ADAPTERS implement those contracts and can be swapped, composed, or
 * mocked WITHOUT touching the domain (Dependency Inversion).
 * Every adapter that implements a port is substitutable (Liskov), each has
 * a single reason to change (SRP), and new behaviour is added by writing a
 * NEW adapter / module rather than editing existing ones (Open/Closed).
 *
 * ───────────────────────────  PORTS  ───────────────────────────
 *   RepositorySource   async list()            -> { items: Repo[], source }
 *   DownloadGate       tryConsume(key)         -> { allowed, retryInMs, remaining }
 *   MessageChannel     async send(message)     -> { ok, ref }
 *   MediaSource        async list()            -> Media[]            (extension point)
 *   ContentModule      { id, label, mount }                         (extension point)
 *
 * To plug a REAL backend: replace an adapter below with one that calls your
 * API (e.g. a `ServerDownloadGate` that hits POST /cv-requests for true
 * server-side rate limiting, or an `SmtpMessageChannel`). The domain code
 * never changes — it only knows the port.
 */

/* ============================ PORTS (RepositorySource) ============================ */

/** Live adapter — talks to the public GitHub REST API. */
export class GitHubRepositoryAdapter {
  constructor(user, { timeoutMs = 6500 } = {}) {
    this.user = user;
    this.timeoutMs = timeoutMs;
  }
  async list() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(
        `https://api.github.com/users/${this.user}/repos?per_page=100&sort=updated`,
        { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } }
      );
      if (!res.ok) throw new Error('github ' + res.status); // 403 => rate limited
      const raw = await res.json();
      const items = raw
        .filter((r) => !r.fork)
        .map((r) => ({
          name: r.name,
          desc: r.description || '',
          url: r.html_url,
          language: r.language || '—',
          stars: r.stargazers_count,
          forks: r.forks_count,
          topics: r.topics || [],
          updated: r.pushed_at,
        }))
        .sort(
          (a, b) =>
            b.stars - a.stars || new Date(b.updated) - new Date(a.updated)
        );
      return { items, source: 'live' };
    } finally {
      clearTimeout(t);
    }
  }
}

/** Curated adapter — same contract, zero network. Used as resilient fallback. */
export class CuratedRepositoryAdapter {
  constructor(seed = []) {
    this.seed = seed;
  }
  async list() {
    return { items: this.seed, source: 'fallback' };
  }
}

/**
 * Composes a primary + fallback RepositorySource behind the SAME port.
 * The domain cannot tell which one answered — that is the point.
 */
export class ResilientRepositoryService {
  constructor(primary, fallback) {
    this.primary = primary;
    this.fallback = fallback;
  }
  async list() {
    try {
      const out = await this.primary.list();
      if (out.items && out.items.length) return out;
      throw new Error('empty');
    } catch (e) {
      const fb = await this.fallback.list();
      return { ...fb, source: 'fallback', reason: String(e.message || e) };
    }
  }
}

/* ============================ PORTS (DownloadGate) ============================ */

/**
 * Token-bucket rate limiter (DownloadGate adapter), persisted in localStorage.
 * Defends the CV-request action against abuse / floods on the CLIENT.
 *
 * NOTE: client-side limiting is a UX guard, not a security boundary — a
 * determined attacker bypasses localStorage. The identical contract should
 * be enforced server-side by a `ServerDownloadGate` adapter (same method
 * signature) hitting your API; swap it in `buildPortfolioCore` with no other
 * change. That is the whole hexagonal payoff.
 */
export class TokenBucketGate {
  constructor({ capacity = 3, refillMs = 60 * 60 * 1000, storageKey = 'gate' } = {}) {
    this.capacity = capacity;
    this.refillMs = refillMs;
    this.storageKey = storageKey;
  }
  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || null;
    } catch {
      return null;
    }
  }
  _write(s) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(s));
    } catch {}
  }
  tryConsume() {
    const now = Date.now();
    let s = this._read() || { tokens: this.capacity, updated: now };
    // continuous refill
    const refill = ((now - s.updated) / this.refillMs) * this.capacity;
    s.tokens = Math.min(this.capacity, s.tokens + refill);
    s.updated = now;
    if (s.tokens >= 1) {
      s.tokens -= 1;
      this._write(s);
      return { allowed: true, remaining: Math.floor(s.tokens), retryInMs: 0 };
    }
    this._write(s);
    const need = 1 - s.tokens;
    return {
      allowed: false,
      remaining: 0,
      retryInMs: Math.ceil((need / this.capacity) * this.refillMs),
    };
  }
}

/* ============================ PORTS (MessageChannel) ============================ */

/**
 * Stub MessageChannel — stores outbound messages in a localStorage "outbox".
 * Replace with `FormspreeChannel`, `SmtpChannel`, etc. (same async send()).
 */
export class LocalOutboxChannel {
  constructor(storageKey = 'outbox') {
    this.storageKey = storageKey;
  }
  async send(message) {
    const ref = 'MSG-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    try {
      const box = JSON.parse(localStorage.getItem(this.storageKey)) || [];
      box.push({ ...message, ref, at: new Date().toISOString() });
      localStorage.setItem(this.storageKey, JSON.stringify(box));
    } catch {}
    return { ok: true, ref };
  }
}

/* ============================ PORTS (MediaSource) ============================ */

/**
 * GooglePhotosAdapter — MediaSource adapter that reads a Google Photos album
 * THROUGH YOUR OWN serverless function (see /serverless/api/google-photos.js).
 *
 * The browser never holds Google credentials: the function does the OAuth +
 * Library API call server-side and returns a tiny JSON list. This adapter
 * just fetches that endpoint. To swap providers (Cloudinary, S3, a GitHub
 * /album folder) write another adapter with the same `list()` contract — the
 * Album section doesn't know or care which one answered.
 *
 *   list() -> { items: [{ url, width, height, alt, date }], source }
 *             source: 'live' | 'empty' | 'error'
 */
export class GooglePhotosAdapter {
  constructor(endpoint, { timeoutMs = 7000 } = {}) {
    this.endpoint = endpoint || '';
    this.timeoutMs = timeoutMs;
  }
  async list() {
    if (!this.endpoint) return { items: [], source: 'empty' };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpoint, { signal: ctrl.signal });
      if (!res.ok) throw new Error('media ' + res.status);
      const data = await res.json();
      const items = (data.items || []).map((p) => ({
        url: p.url,
        width: p.width,
        height: p.height,
        date: p.date || '',
        alt: p.alt || 'Photo',
      }));
      return { items, source: items.length ? 'live' : 'empty' };
    } catch (e) {
      return { items: [], source: 'error', reason: String(e.message || e) };
    } finally {
      clearTimeout(t);
    }
  }
}

/**
 * StaticManifestMediaAdapter — MediaSource port implementation backed by a
 * committed JSON manifest file (`assets/album/photos.json`). Sibling of
 * GooglePhotosAdapter; same constructor/fetch/timeout/error-swallow contract.
 * PURE and DETERMINISTIC — returns the full item pool in stable order so the
 * adapter is trivially unit-testable. Randomness lives in the view layer.
 *
 * Manifest schema: { items: [{ url, width, height, alt?, date? }] }
 *   url    — path relative to the served page (e.g. assets/album/img-01.webp)
 *   width  — optional, for forward-compat (intrinsic-size / CLS)
 *   height — optional, same
 *   alt    — defaults to 'Photo' when absent
 *   date   — defaults to ''   when absent
 */
export class StaticManifestMediaAdapter {
  constructor(manifestUrl, { timeoutMs = 7000 } = {}) {
    this.manifestUrl = manifestUrl || '';
    this.timeoutMs = timeoutMs;
  }
  async list() {
    if (!this.manifestUrl) return { items: [], source: 'empty' };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.manifestUrl, { signal: ctrl.signal });
      if (!res.ok) throw new Error('manifest ' + res.status);
      const data = await res.json();
      // Accept plain array or { items: [] } shape defensively
      const raw = Array.isArray(data) ? data : (data.items || []);
      const items = raw.map((p) => ({
        url: p.url,
        width: p.width,
        height: p.height,
        alt: p.alt || 'Photo',
        date: p.date || '',
      }));
      return { items, source: items.length ? 'live' : 'empty' };
    } catch (e) {
      return { items: [], source: 'error', reason: String(e.message || e) };
    } finally {
      clearTimeout(t);
    }
  }
}

/* ============================ COMPOSITION ROOT ============================ */

/**
 * The ONLY place adapters are wired to ports. Swap any line here to change
 * infrastructure (live↔curated repos, client↔server gate, outbox↔SMTP) with
 * zero changes to the domain/UI. Add a new capability by adding a port + a
 * module entry — never by editing the ones above.
 */
export function buildPortfolioCore(cfg = {}) {
  const live = new GitHubRepositoryAdapter(cfg.githubUser || 'Jaramilloh');
  const curated = new CuratedRepositoryAdapter(cfg.curated || []);
  const media = new StaticManifestMediaAdapter(cfg.photosManifest || './assets/album/photos.json');
  return {
    repositories: new ResilientRepositoryService(live, curated),
    media,
    cvGate: new TokenBucketGate({
      capacity: 3,
      refillMs: 60 * 60 * 1000,
      storageKey: 'jfjh.cvGate.v1',
    }),
    contact: new LocalOutboxChannel('jfjh.contactOutbox.v1'),
    /**
     * Module registry (Open/Closed). Register a section once; the shell
     * renders whatever is registered. Add "Talks", "Patents", "Datasets"…
     * by pushing a new descriptor here — nothing else needs to know.
     */
    modules: [
      { id: 'work', label: 'Featured Work', enabled: true },
      { id: 'repos', label: 'Repositories', enabled: true },
      { id: 'research', label: 'Research', enabled: true },
      { id: 'stack', label: 'Stack', enabled: true },
      { id: 'timeline', label: 'Trajectory', enabled: true },
      { id: 'album', label: 'Album', enabled: true },
      { id: 'blog', label: 'Writing', enabled: true },
    ],
  };
}
