# /serverless — Google Photos → MediaSource adapter

This backend lets the portfolio's **Album** section read a Google Photos album
**without exposing your Google credentials to the browser**. It's a single
Vercel serverless function; the front-end calls it and renders the JSON. It is
a drop-in for the `MediaSource` port — nothing else in the site changes.

```
browser  →  GET https://your-app.vercel.app/api/google-photos
            (GooglePhotosAdapter in core.js)
                       │
            serverless function  →  Google OAuth + Photos Library API
                       │
            ←  { items: [{ url, alt, date }], source: "live" }
```

---

## ⚠️ Read this first — Google Photos API status (2025)

Google tightened the **Photos Library API** in 2025. Reading an *existing
personal album* with the `photoslibrary.readonly` scope works for OAuth clients
that already have that scope approved, but **brand-new projects may be limited**
to the interactive **Picker API** or to app-created media only.

**So the order is: try this (B). If step 2 won't grant `photoslibrary.readonly`
for your album, we fall back to committing photos to an `/album` folder (A).**
The front-end is identical either way — only the adapter swaps.

---

## Setup (≈15 min)

### 1. Google Cloud project
- Create a project → enable **Photos Library API**.
- **OAuth consent screen**: User type *External*; add your own Google account
  under *Test users*.
- **Credentials → Create OAuth client → Web application**. Add
  `https://developers.google.com/oauthplayground` as an *Authorized redirect URI*.
- Copy the **Client ID** and **Client secret**.

### 2. Get a refresh token (via OAuth Playground)
1. Open <https://developers.google.com/oauthplayground>.
2. Gear icon (top-right) → check **Use your own OAuth credentials** → paste your
   client id + secret.
3. In the left "Input your own scopes" box, enter:
   `https://www.googleapis.com/auth/photoslibrary.readonly`
4. **Authorize APIs** → sign in → allow.  *(If Google refuses this scope, stop —
   go with fallback A.)*
5. **Exchange authorization code for tokens** → copy the **Refresh token**.

### 3. Deploy to Vercel (free)
- Put this `/serverless` folder in its own repo (or import the subfolder) into
  **Vercel**. The file at `api/google-photos.js` is auto-served at
  `/api/google-photos`.

### 4. Environment variables (Vercel → Settings → Environment Variables)
| Key | Value |
|---|---|
| `GP_CLIENT_ID` | your OAuth client id |
| `GP_CLIENT_SECRET` | your OAuth client secret |
| `GP_REFRESH_TOKEN` | the refresh token from step 2 |
| `ALLOW_ORIGIN` | **required** — your site origin, e.g. `https://jaramilloh.github.io`. If unset, no CORS header is sent and cross-origin reads fail closed (never `*`). |
| `GP_SETUP_TOKEN` | optional — secret that unlocks the `?albums=1` setup helper (step 5) |

Deploy.

### 5. Find your album id
Set a temporary **`GP_SETUP_TOKEN`** env var, then visit
`https://your-app.vercel.app/api/google-photos?albums=1&token=<GP_SETUP_TOKEN>`,
find the album you want in the JSON, copy its `id`, add env var **`GP_ALBUM_ID`**,
redeploy. Without the token the helper returns 404, so the album list is never
publicly enumerable — you can remove `GP_SETUP_TOKEN` once setup is done.

### 6. Connect the site
In **`Juan Felipe Jaramillo.dc.html`** set:

```js
PHOTOS_ENDPOINT = 'https://your-app.vercel.app/api/google-photos';
```

The Album section flips from *MEDIASOURCE · AWAITING* to *LIVE · GOOGLE PHOTOS*
and fills automatically.

---

## Notes
- **baseUrl expiry**: Google image URLs expire ~60 min; the function caches only
  10 min, so visitors always get fresh URLs.
- **Quota protection**: in-memory + CDN caching means a traffic burst hits your
  cache, not Google — the server-side version of the site's rate-limit idea.
- **Netlify / Cloudflare Workers**: a near-direct port — same three fetches
  (`getAccessToken`, `mediaItems:search`, optional `albums`). Move the env vars
  and adjust the handler signature.
- **Privacy**: only photos in the one `GP_ALBUM_ID` album are ever exposed.
