# Album pool

## Automated refresh (`npm run album:sync`)

Use this when you have a Google Photos Takeout export and want to regenerate the
image pool in one command. The tool samples, resizes, converts to WebP, writes the
manifest, and stages the diff — leaving commit and push to you.

### One-time setup

1. Open Google Photos and create a dedicated album (e.g. "Portfolio").
2. Export via **Google Takeout** — select only "Google Photos", choose your album.
3. Unzip the Takeout archive. You will have a folder like:
   `~/Downloads/Takeout/Google Photos/Portfolio/`
4. That folder path is your `--src` argument.

### Per-refresh command

```bash
npm run album:sync -- --src <path/to/Takeout/Google Photos/Album Name>
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--src <dir>` | required | Path to the unzipped Takeout album folder |
| `--count <n>` | `8` | Number of images to sample (min 1, max min(pool, 30)) |
| `--seed <n>` | none | Integer seed for reproducible selection |
| `--commit` | off | Auto-commit after writing (still does NOT push) |

### What the tool does

1. **Sample** — picks `--count` images at random from `--src` (deterministic with `--seed`).
2. **Optimize** — resizes each to long-edge ≤ 1600 px and encodes as WebP. The byte
   budget scales with the source **resolution** (≈60 KB per megapixel), clamped to a
   **256 KB floor** and a **1.5 MB ceiling**, so high-resolution camera originals keep
   their detail at quality 80 instead of being over-compressed, while the committed repo
   stays bounded. Megapixels (not file size) drives the budget because a JPEG's byte size
   depends on in-camera compression and is a noisy proxy for actual detail.
3. **Extract metadata** — reads Google Takeout sidecar JSON for date and caption; falls back to EXIF.
4. **Write** — saves `gp-01.webp`, `gp-02.webp`, … to this folder and writes `photos.json`.
5. **Clean up** — removes any stale `gp-*.webp` files from a previous run.
6. **Stage** — runs `git add` on all written files. You review, commit, and push.

> The tool NEVER auto-commits or auto-pushes (unless `--commit` is passed, which still does not push).

---



The Album section (`#album`) on the site is fed by **`photos.json`** in this folder — a
static manifest of images committed to the repo. On each page load the site shows **one
featured photo + a random 2–4 grid**, picked client-side from the pool. No runtime API,
no build step, no external service.

> Why curated and not synced from Google Photos? Google removed unattended album-read
> access from its Library API on 2025-03-31 (the scopes now return `403`, and the
> replacement Picker API requires a human to select photos interactively). There is no
> way to auto-pull an existing Google Photos album anymore — so the pool is a manual,
> committed set that you control.

## Refresh the pool (3 steps)

### 1. Optimize the images
Keep the repo small and the page fast. For each photo:
- **Resize** the long edge to ~1600px max.
- **Compress** to WebP (preferred) or optimized JPEG, aiming for **≤ ~250 KB each**.
- Keep the pool **bounded: ~6–10 images** total (the grid only ever shows 2–4).

Any tool works — `cwebp -q 80 in.jpg -o img-01.webp`, ImageMagick
(`magick in.jpg -resize 1600x1600\> -quality 82 img-01.webp`), Squoosh, etc.

### 2. Drop the files in this folder
Name them predictably, e.g. `img-01.webp`, `img-02.webp`, … Commit the binaries
directly (plain git — the pool is small enough that git-lfs is unnecessary).

### 3. Update `photos.json`
List every image as one entry in `items`:

```json
{
  "items": [
    {
      "url": "assets/album/img-01.webp",
      "width": 1600,
      "height": 1067,
      "alt": "Sunrise over the Valencia coastline",
      "date": "2025-08-14"
    }
  ]
}
```

| Field    | Required | Notes                                                                 |
|----------|----------|-----------------------------------------------------------------------|
| `url`    | yes      | Path **relative to the site root**, e.g. `assets/album/img-01.webp`.   |
| `width`  | no       | Pixel width. Carried through for forward-compat; current layout uses a fixed aspect ratio. |
| `height` | no       | Pixel height. Same as above.                                          |
| `alt`    | no       | Accessibility text. Defaults to `"Photo"` if omitted.                 |
| `date`   | no       | ISO date string. Defaults to `""` if omitted.                         |

Commit `photos.json` together with the images. That's it — the site reads the new pool
on the next load.

## Behavior notes

- **Empty pool degrades gracefully.** If `items` is `[]` (the shipped placeholder) or the
  file is missing, the section shows a "MEDIASOURCE · AWAITING" state — no error, no crash.
- **The shuffle is per page load**, picked once on mount and stable across re-renders
  (it does not reshuffle while you scroll).
- **Where the path is configured:** `PHOTOS_MANIFEST` in `Juan Felipe Jaramillo.dc.html`
  (defaults to `./assets/album/photos.json`). You normally never need to touch it.

## How it's wired (for maintainers)

`StaticManifestMediaAdapter` in `core.js` implements the `MediaSource.list()` port and
reads this manifest. To swap the photo source later (a different folder, an S3/R2 bucket,
or a provider with a still-open album API), write a new adapter with the same `list()`
contract and change the one composition-root line in `buildPortfolioCore` — the `#album`
section is source-agnostic.
