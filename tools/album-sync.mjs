/**
 * album-sync.mjs
 *
 * Build-time CLI: randomly samples a Google Takeout album export, optimizes
 * images to WebP, derives metadata from Takeout sidecars or EXIF, writes
 * assets/album/gp-*.webp + assets/album/photos.json, and stages the diff.
 *
 * Pure functions are exported and importable without executing main().
 * main() only runs when this file is invoked directly as a CLI.
 */

import { createRequire } from 'module';
import { pathToFileURL } from 'url';

// ── mulberry32 ────────────────────────────────────────────────────────────────

/**
 * Seeded PRNG using the mulberry32 algorithm.
 * Returns a function that produces numbers in [0, 1) deterministically.
 *
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── sampleImages ──────────────────────────────────────────────────────────────

/**
 * Randomly sample `count` distinct items from `files`.
 *
 * - If count > files.length, all files are returned (no error).
 * - count is clamped to [1, min(files.length, 30)].
 * - With a seed, selection is deterministic via mulberry32.
 * - Without a seed, Math.random is used (non-deterministic).
 *
 * @param {string[]} files
 * @param {number} [count=8]
 * @param {number} [seed]
 * @returns {string[]}
 */
export function sampleImages(files, count = 8, seed) {
  const pool = [...files];
  const n = Math.max(1, Math.min(count, pool.length, 30));
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;

  // Fisher-Yates partial shuffle — only up to n elements
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, n);
}

// ── extractMetadata ───────────────────────────────────────────────────────────

/**
 * Derive { alt, date } from a Takeout sidecar JSON and/or EXIF data.
 *
 * Priority:
 * 1. sidecar.description → alt
 * 2. sidecar.photoTakenTime.timestamp → date (Unix seconds → ISO date)
 * 3. exif.DateTimeOriginal → date fallback
 * 4. Hard defaults: alt='Photo', date=''
 *
 * Never throws.
 *
 * @param {{ sidecar?: object, exif?: object }} opts
 * @returns {{ alt: string, date: string }}
 */
export function extractMetadata({ sidecar, exif } = {}) {
  let alt = 'Photo';
  let date = '';

  try {
    if (sidecar && sidecar.description && sidecar.description.trim()) {
      alt = sidecar.description.trim();
    }
  } catch (_) {
    // ignore
  }

  try {
    if (sidecar && sidecar.photoTakenTime && sidecar.photoTakenTime.timestamp) {
      const ts = parseInt(sidecar.photoTakenTime.timestamp, 10);
      if (!isNaN(ts)) {
        date = new Date(ts * 1000).toISOString().slice(0, 10);
      }
    }
  } catch (_) {
    // ignore
  }

  if (!date) {
    try {
      if (exif && exif.DateTimeOriginal) {
        const d = exif.DateTimeOriginal instanceof Date
          ? exif.DateTimeOriginal
          : new Date(exif.DateTimeOriginal);
        if (!isNaN(d.getTime())) {
          date = d.toISOString().slice(0, 10);
        }
      }
    } catch (_) {
      // ignore
    }
  }

  return { alt, date };
}

// ── computeBudget ───────────────────────────────────────────────────────────

/**
 * Compute the per-image output byte budget, scaled to the source resolution
 * in megapixels.
 *
 * High-resolution camera sources (e.g. ~16 MP) carry more detail than the
 * previous flat 256 KB budget could preserve at quality 80, so the budget
 * scales with megapixels. Megapixels is preferred over file size because a
 * camera JPEG's byte size depends on its in-camera compression and is noisy,
 * whereas pixel count is a stable measure of how much detail there is to keep.
 * The result is clamped between `floor` (never compress harder than the old
 * behavior) and `ceiling` (so the committed repo can never blow up).
 *
 * Note: images are downscaled to <= maxEdge before encoding, so megapixels are
 * a heuristic for "how much detail to preserve", not a literal output mapping.
 *
 * @param {number} [megapixels] — source resolution as width*height/1e6
 * @param {{ floor?: number, perMegapixel?: number, ceiling?: number }} [opts]
 * @returns {number} effective maxBytes budget
 */
export function computeBudget(
  megapixels,
  { floor = 256000, perMegapixel = 60000, ceiling = 1500000 } = {}
) {
  if (!megapixels || megapixels <= 0) return floor;
  const scaled = Math.round(megapixels * perMegapixel);
  return Math.min(ceiling, Math.max(floor, scaled));
}

// ── optimizeImage ─────────────────────────────────────────────────────────────

/**
 * Optimize an image buffer: resize long edge ≤ maxEdge, encode as WebP.
 * Quality backoff loop: 80 → 65 → 50 if output exceeds the byte budget.
 *
 * The budget is `maxBytes` unless `sourceMegapixels` is supplied, in which case
 * it is scaled via computeBudget (with `maxBytes` acting as the floor).
 *
 * @param {Buffer|string} input
 * @param {{ maxEdge?: number, maxBytes?: number, sourceMegapixels?: number }} [opts]
 * @returns {Promise<{ data: Buffer, width: number, height: number }>}
 */
export async function optimizeImage(
  input,
  { maxEdge = 1600, maxBytes = 256000, sourceMegapixels } = {}
) {
  const sharp = (await import('sharp')).default;

  const budget =
    sourceMegapixels !== undefined
      ? computeBudget(sourceMegapixels, { floor: maxBytes })
      : maxBytes;

  const qualities = [80, 65, 50];
  let data;
  let info;

  for (const quality of qualities) {
    const result = await sharp(input)
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer({ resolveWithObject: true });

    data = result.data;
    info = result.info;

    if (data.length <= budget) break;
  }

  return { data, width: info.width, height: info.height };
}

// ── buildManifest ─────────────────────────────────────────────────────────────

/**
 * Build the photos.json manifest object from optimized image entries.
 *
 * Output schema matches core.js:246-253 contract exactly:
 * { items: [{ url, width, height, alt, date }] }
 *
 * @param {{ filename: string, width: number, height: number, alt?: string, date?: string }[]} entries
 * @returns {{ items: { url: string, width: number, height: number, alt: string, date: string }[] }}
 */
export function buildManifest(entries) {
  const items = entries.map(({ filename, width, height, alt, date }) => ({
    url: `assets/album/${filename}`,
    width,
    height,
    alt: alt || 'Photo',
    date: date || '',
  }));
  return { items };
}

// ── planCleanup ───────────────────────────────────────────────────────────────

/**
 * Determine which existing files under assets/album/ are safe to remove.
 *
 * Only gp-*.webp files and photos.json are removable.
 * README.md and any other assets are NEVER in the removable set.
 *
 * @param {string[]} existing — filenames (basename only, not full paths)
 * @returns {{ removable: string[] }}
 */
export function planCleanup(existing) {
  const removable = existing.filter(
    f => /^gp-.*\.webp$/.test(f) || f === 'photos.json'
  );
  return { removable };
}

// ── main() helpers ────────────────────────────────────────────────────────────

/**
 * Parse CLI argv into structured options.
 * @param {string[]} argv
 * @returns {{ src: string|null, count: number, seed: number|undefined, commit: boolean }}
 */
function parseArgs(argv) {
  const args = { src: null, count: 8, seed: undefined, commit: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src' && argv[i + 1]) args.src = argv[++i];
    else if (argv[i] === '--count' && argv[i + 1]) args.count = parseInt(argv[++i], 10);
    else if (argv[i] === '--seed' && argv[i + 1]) args.seed = parseInt(argv[++i], 10);
    else if (argv[i] === '--commit') args.commit = true;
  }
  return args;
}

/**
 * Print a human-readable summary.
 * @param {string[]} written
 */
function printSummary(written) {
  process.stdout.write(`\nalign-sync complete — ${written.length} image(s) written and staged:\n`);
  for (const f of written) process.stdout.write(`  ${f}\n`);
  process.stdout.write('\nFiles staged via git add. Review + push when ready.\n\n');
}

// ── main() ────────────────────────────────────────────────────────────────────

/**
 * CLI entry point. Only executes when invoked directly (not on import).
 * @param {string[]} argv
 */
async function main(argv) {
  const { readdirSync, statSync, readFileSync, writeFileSync, unlinkSync, existsSync } =
    await import('fs');
  const { join, resolve, basename } = await import('path');
  const { execFileSync } = await import('child_process');
  const sharp = (await import('sharp')).default;
  const exifr = (await import('exifr')).default;

  const args = parseArgs(argv);

  if (!args.src) {
    process.stderr.write('Error: --src <dir> is required.\n');
    process.exit(1);
  }

  const srcDir = resolve(args.src);
  if (!existsSync(srcDir)) {
    process.stderr.write(`Error: source directory does not exist: ${srcDir}\n`);
    process.exit(1);
  }

  const IMAGE_RE = /\.(jpe?g|png|webp|gif|tiff?)$/i;
  const MAX_SIZE = 50 * 1024 * 1024;

  let allFiles;
  try {
    allFiles = readdirSync(srcDir);
  } catch (err) {
    process.stderr.write(`Error: cannot read directory: ${err.message}\n`);
    process.exit(1);
  }

  const imageFiles = allFiles.filter(f => {
    if (!IMAGE_RE.test(f)) return false;
    try {
      const size = statSync(join(srcDir, f)).size;
      if (size > MAX_SIZE) {
        console.warn(`Skipping large file (>${MAX_SIZE / 1e6} MB): ${f}`);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  if (imageFiles.length === 0) {
    process.stderr.write(`Error: no image files found in ${srcDir}\n`);
    process.exit(1);
  }

  const selected = sampleImages(imageFiles, args.count, args.seed);

  const albumDir = resolve('assets/album');
  const existing = existsSync(albumDir) ? readdirSync(albumDir) : [];
  const { removable } = planCleanup(existing);

  for (const f of removable) {
    try {
      unlinkSync(join(albumDir, f));
    } catch (err) {
      console.warn(`Warning: could not delete ${f}: ${err.message}`);
    }
  }

  const entries = [];
  const writtenPaths = [];

  for (let i = 0; i < selected.length; i++) {
    const filename = selected[i];
    const srcPath = join(srcDir, filename);
    const index = String(i + 1).padStart(2, '0');
    const outName = `gp-${index}.webp`;
    const outPath = join(albumDir, outName);

    let buffer;
    try {
      buffer = readFileSync(srcPath);
    } catch (err) {
      console.warn(`Warning: could not read ${filename}: ${err.message}`);
      continue;
    }

    let sidecar = null;
    for (const sidecarName of [`${filename}.json`, `${filename}.supplemental-metadata.json`]) {
      const sp = join(srcDir, sidecarName);
      if (existsSync(sp)) {
        try {
          sidecar = JSON.parse(readFileSync(sp, 'utf8'));
          break;
        } catch (err) {
          console.warn(`Warning: could not parse sidecar ${sidecarName}: ${err.message}`);
        }
      }
    }

    let exifData = null;
    try {
      exifData = await exifr.parse(buffer, ['DateTimeOriginal']);
    } catch {
      // exif not available — use defaults
    }

    const meta = extractMetadata({ sidecar, exif: exifData });

    let sourceMegapixels;
    try {
      const srcMeta = await sharp(buffer).metadata();
      if (srcMeta.width && srcMeta.height) {
        sourceMegapixels = (srcMeta.width * srcMeta.height) / 1e6;
      }
    } catch {
      // dimensions unavailable — optimizeImage falls back to the flat budget
    }

    let optimized;
    try {
      optimized = await optimizeImage(buffer, { sourceMegapixels });
    } catch (err) {
      console.warn(`Warning: could not optimize ${filename}: ${err.message}`);
      continue;
    }

    writeFileSync(outPath, optimized.data);
    writtenPaths.push(outPath);
    entries.push({
      filename: outName,
      width: optimized.width,
      height: optimized.height,
      alt: meta.alt,
      date: meta.date,
    });
  }

  const manifest = buildManifest(entries);
  const manifestPath = join(albumDir, 'photos.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  writtenPaths.push(manifestPath);

  // Stage all written files
  try {
    execFileSync('git', ['add', '--', ...writtenPaths], { stdio: 'inherit' });
  } catch (err) {
    console.warn(`Warning: git add failed: ${err.message}`);
  }

  if (args.commit) {
    try {
      execFileSync('git', ['commit', '-m', 'chore(album): refresh photo pool'], {
        stdio: 'inherit',
      });
    } catch (err) {
      console.warn(`Warning: git commit failed: ${err.message}`);
    }
  }

  printSummary(writtenPaths);
}

// Guard: only run main() when invoked directly as CLI
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(err => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
  });
}
