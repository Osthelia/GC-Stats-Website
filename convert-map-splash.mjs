/**
 * GC-Stats - convert-map-splash
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

// Converts a map loading screen into the two webp splashes of the site.
//   splash/{map}.webp     small, for the site and the small map pictures
//   splash-hd/{map}.webp  high quality, for the Discord alert images and their preview
// Usage: node convert-map-splash.mjs Loading_Screen_Abyss.png [more files...] [--out dir]
// The map name is the file name without "Loading_Screen_", lowercased (Loading_Screen_Abyss.png -> abyss).

import { mkdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

const SMALL = { width: 300, height: 169, quality: 80 };
const HD = { width: 1920, height: 1080, quality: 88 };

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outRoot = resolve(outIndex >= 0 ? (args[outIndex + 1] ?? "") : "apps/web/public/valorant/maps");
const files = args.filter((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--out");

if (files.length === 0 || (outIndex >= 0 && !args[outIndex + 1])) {
  console.error("Usage: node convert-map-splash.mjs <image> [more images...] [--out dir]");
  process.exit(1);
}

const slugOf = (file) =>
  basename(file, extname(file))
    .replace(/^Loading_Screen_/i, "")
    .replace(/\s*\(\d+\)$/, "")
    .toLowerCase();

const targets = [
  { dir: "splash", ...SMALL },
  { dir: "splash-hd", ...HD },
];
await Promise.all(targets.map(({ dir }) => mkdir(join(outRoot, dir), { recursive: true })));

const seen = new Set();
let failed = false;
for (const file of files) {
  const slug = slugOf(file);
  if (!/^[a-z0-9_]+$/.test(slug)) {
    console.error("[skip] %s: unusable map name %o", file, slug);
    failed = true;
    continue;
  }
  if (seen.has(slug)) {
    console.warn("[skip] %s: %s already converted in this run", file, slug);
    continue;
  }
  seen.add(slug);
  try {
    for (const { dir, width, height, quality } of targets) {
      const out = join(outRoot, dir, `${slug}.webp`);
      const { size } = await sharp(file).resize(width, height, { fit: "cover" }).webp({ quality }).toFile(out);
      console.log("[ok] %s -> %s (%d KB)", file, join(dir, `${slug}.webp`), Math.round(size / 1024));
    }
  } catch (error) {
    console.error("[error] %s", file, error);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
