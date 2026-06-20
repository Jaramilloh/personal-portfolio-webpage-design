/**
 * One-off script: generates a tiny 10x10 white JPEG fixture for tests.
 * Run once: node tests/fixtures/album-sync/generate-tiny.mjs
 * Output: tests/fixtures/album-sync/tiny.jpg (~400 bytes)
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, 'tiny.jpg');

await sharp({
  create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .jpeg({ quality: 80 })
  .toFile(outPath);

console.log(`Generated: ${outPath}`);
