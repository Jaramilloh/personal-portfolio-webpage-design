# Juan Felipe Jaramillo-Hernández — Personal Portfolio

A dark, "detection-canvas" themed personal website for an ML / computer-vision
engineer. Built as a **single streaming Design Component** with a **hexagonal
(ports & adapters) core** so every capability — GitHub repos, CV gate, contact,
photo album — is a swappable module you can extend without touching the rest.

> **Theme:** the whole page is styled like a YOLO detector's output — bounding
> boxes, confidence labels, corner brackets, a depth-cyan legend and a scan
> line — a nod to the **Depth Object Detector (DOD)**, the flagship work.

---

## Table of contents
1. [Tech & philosophy](#tech--philosophy)
2. [Project structure](#project-structure)
3. [Run locally](#run-locally)
4. [Architecture (ports & adapters)](#architecture-ports--adapters)
5. [Configuration](#configuration)
6. [Images / assets](#images--assets)
7. [Sections](#sections)
8. [GitHub repositories (live)](#github-repositories-live)
9. [CV page](#cv-page)
10. [Contact](#contact)
11. [Google Photos album](#google-photos-album)
12. [Deploy to GitHub Pages](#deploy-to-github-pages)
13. [Extending the site](#extending-the-site)
14. [Maintaining with Claude Code](#maintaining-with-claude-code)
15. [Credits & links](#credits--links)

---

## Tech & philosophy

- **No framework build step.** The page is one HTML file plus two small JS
  modules. It runs from any static host (GitHub Pages, Netlify, Vercel, S3).
- **SOLID + Hexagonal architecture.** The page (the *domain*) depends only on
  **ports** (abstract contracts). Concrete **adapters** implement those ports
  and are wired in one place (`buildPortfolioCore` in `core.js`). Swap live
  GitHub for a curated list, a client rate-limiter for a server one, an outbox
  stub for real email — the UI never changes.
- **Type / color system.** Space Grotesk (display) · IBM Plex Sans (body) · IBM
  Plex Mono (labels). Near-black cool background `#0d0f12`; one detection-lime
  accent `#b8f24a` + a depth-cyan `#45dcef`.

### A note on the runtime
The main file is a **Design Component** (`*.dc.html`). It includes `support.js`,
a small runtime that renders the template + logic class. You do **not** edit
`support.js`. You edit:
- the **template** (the markup) and
- the **logic class** (`class Component`) at the bottom of the file, and
- **`core.js`** for the architecture/adapters.

---

## Project structure

```
.
├── Juan Felipe Jaramillo.dc.html   # the site: template + logic class
├── CV.dc.html                      # CV page (deployed as cv.html)
├── support.js                      # DC runtime (do NOT edit)
├── core.js                         # hexagonal core — ports + adapters
├── assets/
│   ├── portrait.png                # hero photo (1024×1024)
│   ├── portrait.jpeg               # CV portrait
│   └── dod-demo.png                # DOD inference result (320×569)
├── serverless/                     # optional backend for Google Photos
│   ├── api/google-photos.js        # Vercel function
│   └── README.md                   # step-by-step setup
└── README.md                       # this file
```

---

## Run locally

The site uses ES-module `import()` and `fetch()`, so it must be served over
**http**, not opened via `file://`. Any static server works:

```bash
# Python 3
python3 -m http.server 8080

# or Node
npx serve .
```

Then open `http://localhost:8080/Juan%20Felipe%20Jaramillo.dc.html`.

(For a clean URL, copy the file to `index.html` — see
[Deploy to GitHub Pages](#deploy-to-github-pages).)

---

## Architecture (ports & adapters)

```
   ADAPTERS (IO, swappable)        PORTS (contracts)         DOMAIN
 ┌───────────────────────────┐  ┌────────────────────┐  ┌────────────┐
 │ GitHubRepositoryAdapter   │─▶│ RepositorySource   │─▶│            │
 │ CuratedRepositoryAdapter  │  │                    │  │  Portfolio │
 │ TokenBucketGate (client)  │─▶│ DownloadGate       │─▶│   shell    │
 │ ServerGate → your API     │  │                    │  │            │
 │ LocalOutboxChannel (stub) │─▶│ MessageChannel     │─▶│ (this page)│
 │ Smtp / Formspree → plug   │  │                    │  │            │
 │ GooglePhotosAdapter       │─▶│ MediaSource        │─▶│            │
 │ Cloudinary / S3 → plug    │  │                    │  └────────────┘
 └───────────────────────────┘  └────────────────────┘
```

| Port | Contract | Adapters provided | Where to plug a real backend |
|---|---|---|---|
| `RepositorySource` | `list() → {items, source}` | `GitHubRepositoryAdapter` (live), `CuratedRepositoryAdapter` (fallback), composed by `ResilientRepositoryService` | already live — uses the public GitHub API |
| `DownloadGate` | `tryConsume() → {allowed, retryInMs, remaining}` | `TokenBucketGate` (localStorage, 3/hr) | replace with a `ServerGate` that hits your API for real, server-side limiting |
| `MessageChannel` | `send(msg) → {ok, ref}` | `LocalOutboxChannel` (writes a localStorage outbox) | swap for Formspree / your SMTP / a serverless function |
| `MediaSource` | `list() → {items, source}` | `GooglePhotosAdapter` (calls your function) | deploy `serverless/` or swap for a committed-folder adapter |

**The composition root** — the only place adapters meet ports — is
`buildPortfolioCore(cfg)` at the bottom of `core.js`. Change infrastructure
there; nothing else needs to know.

```js
// core.js
export function buildPortfolioCore(cfg = {}) {
  const live    = new GitHubRepositoryAdapter(cfg.githubUser || 'Jaramilloh');
  const curated = new CuratedRepositoryAdapter(cfg.curated || []);
  const media   = new GooglePhotosAdapter(cfg.photosEndpoint || '');
  return {
    repositories: new ResilientRepositoryService(live, curated),
    media,
    cvGate:  new TokenBucketGate({ capacity: 3, refillMs: 3600000, storageKey: 'jfjh.cvGate.v1' }),
    contact: new LocalOutboxChannel('jfjh.contactOutbox.v1'),
    modules: [ /* Open/Closed registry — add sections here */ ],
  };
}
```

---

## Configuration

All config lives at the **top of the logic class** in
`Juan Felipe Jaramillo.dc.html` (search for `class Component`):

| Setting | Where | Purpose |
|---|---|---|
| GitHub username | `componentDidMount` → `githubUser: 'Jaramilloh'` | which account the repos grid fetches |
| `CV_URL` | class field | URL the CV gate opens (`cv.html`) |
| `PHOTOS_ENDPOINT` | class field (default `''`) | your deployed Google Photos function URL — set this to make the album live |
| Curated repos | `curated = [ … ]` class field | fallback list shown if the GitHub API is rate-limited |
| Timeline dates | template, "Trajectory" section | **edit to your exact record** — a couple are estimates |

---

## Images / assets

Two images are already wired in `assets/`:

- **`assets/portrait.png`** → hero. Rendered `object-fit: cover` inside the 4:5
  detection frame, with the PERSON / VISION-LEAD overlay boxes on top.
- **`assets/dod-demo.png`** → Featured Work. Your real DOD inference frame,
  shown `object-fit: contain` in a dark 480px panel (it already carries its own
  boxes + depth numbers, so no synthetic overlay is drawn).

To swap either, replace the file (keep the name) or point the `<img src>` at a
new path. Add more imagery the same way.

> **Note on the old drag-and-drop slots:** earlier versions used an
> `image-slot` component you filled by dragging. That depended on this editor's
> runtime and is **removed** — production images are plain `<img>` tags, which
> is what a static host needs.

---

## Sections

Hero · stats (animated counters) · **Featured Work** (DOD) · **Repositories**
(live) · **Research** (2 publications, DOIs) · **Stack** · **Trajectory**
(timeline) · **Album** (Google Photos) · **System** (the architecture diagram) ·
**CV** (gated) · **Writing** (placeholder module) · **Contact** · footer.

Scroll-reveal and counters use an IntersectionObserver **with a scroll-listener
fallback + safety timeout**, so content is never trapped invisible even if IO
doesn't fire.

---

## GitHub repositories (live)

On load the site calls `GET https://api.github.com/users/Jaramilloh/repos`,
filters forks, sorts by stars then recency, and renders the grid. The status
pill shows **LIVE** or **CURATED**.

- The **unauthenticated GitHub API allows ~60 requests/hour per IP.** If you hit
  that limit the request 403s and `ResilientRepositoryService` transparently
  falls back to the `curated` list — the UI is identical.
- To raise the limit you'd proxy through a serverless function that adds a token
  (another adapter swap; the front-end stays the same).

---

## CV page

The CV is a self-contained designer page (`CV.dc.html`) deployed at `cv.html`.
The "View CV" button in the Reach Me section opens it in a new tab.

- **Export to PDF:** open `cv.html` in the browser and use the browser's print
  dialog (or the "SAVE AS PDF" button on the page). The page has `@media print`
  styles that produce a clean A4 PDF.
- **To update the CV:** edit `CV.dc.html` directly. No build step required.
- **Portrait:** stored at `assets/portrait.jpeg` and referenced from the CV page.
- The `cvGate` (`TokenBucketGate`) remains wired in `core.js` but is no longer
  used by the CTA — it is retained as an optional guard for future use.

---

## Contact

The form calls `contact.send()`. The default `LocalOutboxChannel` just stores
messages in a `localStorage` outbox and returns a reference id — **nothing is
emailed.** To deliver for real, replace it with e.g. a `FormspreeChannel` or a
serverless `SmtpChannel` (same `send(message) → {ok, ref}` contract).

---

## Google Photos album

The Album section reads from the `MediaSource` port. Out of the box
`PHOTOS_ENDPOINT` is empty, so it shows a tasteful **"MEDIASOURCE · AWAITING"**
state. To make it live:

1. Deploy the function in **`serverless/`** — full instructions in
   [`serverless/README.md`](serverless/README.md). In short: a Vercel function
   does the Google OAuth + Photos Library API call server-side (your
   credentials never reach the browser) and returns a small JSON list.
2. Set `PHOTOS_ENDPOINT` in the logic class to your function URL, e.g.
   `'https://your-app.vercel.app/api/google-photos'`.

### ⚠️ Important: Google API status (2025)
Google restricted the Photos Library API in 2025. Reading an existing personal
album with the `photoslibrary.readonly` scope works for OAuth clients that have
it approved, but **new projects may be limited** to the interactive Picker API
or app-created media only. Try the token step in `serverless/README.md` first.

**Fallback (option A) if Google blocks the scope:** commit photos to an
`/album` folder and write a tiny `GitHubFolderAdapter` (same `list()` contract)
that returns those file URLs — or just hardcode an array. Zero backend, fully
static. The Album section won't know the difference.

```js
// drop-in fallback adapter — no server needed
export class FolderMediaAdapter {
  constructor(files = []) { this.files = files; }
  async list() {
    return { items: this.files.map(f => ({ url: f, alt: 'Photo' })),
             source: this.files.length ? 'live' : 'empty' };
  }
}
// then in buildPortfolioCore: media: new FolderMediaAdapter([
//   'album/2026-06.jpg', 'album/2026-05.jpg', ...
// ])
```

---

## Deploy to GitHub Pages

The site is fully static. Two ways:

**A. Multi-file (simplest).**
1. Copy `Juan Felipe Jaramillo.dc.html` to **`index.html`** (keeps the same
   content; the `.dc.html` extension isn't required to run — it just needs
   `support.js` beside it).
2. Commit `index.html`, `support.js`, `core.js`, and `assets/` (plus `cv/` if
   you added the PDF).
3. Repo **Settings → Pages →** deploy from `main` / root. Your site is at
   `https://<user>.github.io/<repo>/` — for this repo, the live URL is
   <https://jaramilloh.github.io/personal-portfolio-webpage-design/>.
4. Set `ALLOW_ORIGIN` in your Vercel function to that exact origin (for the
   album), and `PHOTOS_ENDPOINT` to the function URL.

**B. Single self-contained file (optional).** If you'd rather ship one file with
everything inlined, ask the assistant to produce a bundled `index.html`, or run
your own inliner. Not required — A works.

> Both the `RepositorySource` (GitHub API) and `MediaSource` (your function)
> calls happen from the browser over HTTPS, which GitHub Pages provides, so
> live data works on Pages.

---

## Extending the site

The architecture is built for this. To add, say, a **Talks** section:

1. Define the contract you need (a port), e.g. `TalksSource.list()`.
2. Write an adapter implementing it (`EventbriteTalksAdapter`, or a hardcoded
   list).
3. Register it in `buildPortfolioCore` and push a descriptor to `core.modules`.
4. Add the section markup to the template, reading values from `renderVals()`.

You never modify existing adapters — you add new ones (Open/Closed).

---

## Maintaining with Claude Code

- The two files you'll touch most: **`core.js`** (data, adapters, anything
  "backend-ish") and the **logic class** inside the `.dc.html` (state, handlers,
  `renderVals`). The **template** above the logic class is the markup.
- Keep **inline styles** — the DC runtime paints from inline styles as the file
  streams; avoid moving to external CSS.
- `support.js` is generated runtime — leave it alone.
- When adding a new data source, follow the port/adapter pattern above so the
  UI stays decoupled and testable.

---

## Credits & links

- **GitHub:** https://github.com/Jaramilloh
- **ORCID:** https://orcid.org/0000-0002-0992-1346
- **DOD (Sensors, MDPI, 2024):** https://doi.org/10.3390/s24030937
- **DOD optimization (PAAMS, Springer, 2024):** https://doi.org/10.1007/978-3-031-73058-0_13
- **Depth Object Detector repo:** https://github.com/Jaramilloh/Depth-Object-Detector-DOD

Fonts self-hosted (Space Grotesk, IBM Plex Sans, IBM Plex Mono) — no external font requests; CSP-clean.

---

## License

The **code** in this repository is released under the [MIT License](LICENSE) —
read it, fork it, reuse it. Just keep the copyright notice.

**Personal content is not covered by MIT and remains © Juan Felipe Jaramillo,
all rights reserved.** This includes the name and branding, the portrait and
photos (`assets/portrait.png`, `assets/album/*`), the résumé/CV,
and the written bio and copy. If you build on the code, swap in your own
content — please don't republish this portfolio as your own.
