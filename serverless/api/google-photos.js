// serverless/api/google-photos.js
// ── BACKEND ADAPTER for the site's MediaSource port ────────────────────────
// Vercel serverless function. Reads ONE Google Photos album via the Library
// API using a stored OAuth refresh token, and returns a small JSON list that
// the front-end <GooglePhotosAdapter> (core.js) consumes. The browser never
// sees your Google credentials — that is the entire reason this lives here.
//
//   GET /api/google-photos            -> { items:[{url,width,height,alt,date}], source:'live' }
//   GET /api/google-photos?albums=1   -> { albums:[{id,title,count}] }   (setup helper)
//
// Required environment variables (Vercel → Project → Settings → Env Vars):
//   GP_CLIENT_ID       OAuth 2.0 client id
//   GP_CLIENT_SECRET   OAuth 2.0 client secret
//   GP_REFRESH_TOKEN   refresh token authorized for photoslibrary.readonly
//   GP_ALBUM_ID        id of the album to publish (use ?albums=1&token=… to find it)
//   ALLOW_ORIGIN       REQUIRED. your site origin, e.g. https://jaramilloh.github.io
//                      (no CORS header is sent if unset — cross-origin reads fail closed)
//   GP_SETUP_TOKEN     optional secret that unlocks the ?albums=1 setup helper
//
// Caching: a burst of visitors must not drain your Google API quota — the
// server-side echo of the site's DownloadGate idea. Results are cached in
// memory + at the CDN. Keep TTL well under ~60 min because Google baseUrls
// expire around then.

const TTL_MS = 10 * 60 * 1000;
let CACHE = { at: 0, body: null };

export default async function handler(req, res) {
  // CORS: never default to '*'. Only emit Access-Control-Allow-Origin when
  // ALLOW_ORIGIN is explicitly set to your site origin; otherwise the browser
  // blocks cross-origin reads (fail closed) while same-origin requests still work.
  const origin = process.env.ALLOW_ORIGIN;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const token = await getAccessToken();

    // setup helper: list albums so you can copy GP_ALBUM_ID. Gated behind a secret
    // token so the album inventory is not publicly enumerable — set GP_SETUP_TOKEN
    // and call ?albums=1&token=<GP_SETUP_TOKEN>. Returns 404 otherwise.
    if (req.query && req.query.albums) {
      if (!process.env.GP_SETUP_TOKEN || req.query.token !== process.env.GP_SETUP_TOKEN) {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(200).json({ albums: await listAlbums(token) });
    }

    if (CACHE.body && Date.now() - CACHE.at < TTL_MS) {
      return res.status(200).json(CACHE.body);
    }
    const items = await listAlbumMedia(token, process.env.GP_ALBUM_ID);
    const body = { items, source: 'live', count: items.length, fetchedAt: new Date().toISOString() };
    CACHE = { at: Date.now(), body };
    return res.status(200).json(body);
  } catch (e) {
    // never 500 the front-end — it degrades to the "awaiting" state on empty
    return res.status(200).json({ items: [], source: 'error', error: String(e.message || e) });
  }
}

async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GP_CLIENT_ID,
      client_secret: process.env.GP_CLIENT_SECRET,
      refresh_token: process.env.GP_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error('token ' + r.status + ' ' + (await r.text()));
  return (await r.json()).access_token;
}

async function listAlbums(token) {
  const out = [];
  let pageToken;
  do {
    const url = new URL('https://photoslibrary.googleapis.com/v1/albums');
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('albums ' + r.status);
    const j = await r.json();
    (j.albums || []).forEach((a) => out.push({ id: a.id, title: a.title, count: a.mediaItemsCount }));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

async function listAlbumMedia(token, albumId) {
  if (!albumId) throw new Error('GP_ALBUM_ID not set — call ?albums=1 to find it');
  const items = [];
  let pageToken;
  do {
    const r = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId, pageSize: 100, pageToken }),
    });
    if (!r.ok) throw new Error('search ' + r.status + ' ' + (await r.text()));
    const j = await r.json();
    (j.mediaItems || []).forEach((m) => {
      if (!m.baseUrl) return;
      const meta = m.mediaMetadata || {};
      items.push({
        url: m.baseUrl + '=w1600-h1600',        // sized CDN render URL (expires ~60 min)
        width: meta.width ? +meta.width : undefined,
        height: meta.height ? +meta.height : undefined,
        date: meta.creationTime || '',
        alt: m.description || 'Photo',
      });
    });
    pageToken = j.nextPageToken;
  } while (pageToken);
  return items;
}
