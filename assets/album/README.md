# Album pool

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
