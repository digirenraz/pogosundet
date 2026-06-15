// Regenerate the PWA / home-screen icons from scripts/icon-source.svg.
//
//   node scripts/generate-icons.mjs
//
// Source of truth is the "Direction B / Sundet" medallion (Claude Design handoff,
// 2026-06-15) — the bridge-across-the-Sound collectible medallion that replaced the
// literal Poké Ball. Outputs the three home-screen / push assets the app references:
//   public/icon-192.png        — manifest icon (any maskable)
//   public/icon-512.png        — manifest icon (any maskable)
//   public/apple-touch-icon.png — iOS home screen (192×192)
//
// Uses sharp (already a dependency) to rasterize the SVG. Re-run after editing the
// source SVG and commit the regenerated PNGs.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const svg = await readFile(join(here, 'icon-source.svg'));

const targets = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 192 },
];

for (const { file, size } of targets) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(join(root, file), png);
  console.log(`wrote ${file} (${size}×${size}, ${png.length} bytes)`);
}
