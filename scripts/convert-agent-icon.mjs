/**
 * GC-Stats - convert-agent-icon
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

// Converts an agent icon into the webp used by the site (agents/{agent}.webp).
// Usage: node scripts/convert-agent-icon.mjs Jett.png [more files...] [--out dir]
// The agent slug is the file name lowercased, without "_icon", spaces or "/" (Jett_icon.png -> jett, KAYO_icon.png -> kayo).

import { mkdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

const SIZE = { width: 128, height: 128, quality: 85 };

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outDir = resolve(outIndex >= 0 ? (args[outIndex + 1] ?? "") : "apps/web/public/valorant/agents");
const files = args.filter((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--out");

if (files.length === 0 || (outIndex >= 0 && !args[outIndex + 1])) {
  console.error("Usage: node scripts/convert-agent-icon.mjs <image> [more images...] [--out dir]");
  process.exit(1);
}

const slugOf = (file) =>
  basename(file, extname(file))
    .replace(/\s*\(\d+\)$/, "")
    .replace(/_icon$/i, "")
    .replace(/[\s/]/g, "")
    .toLowerCase();

await mkdir(outDir, { recursive: true });

const seen = new Set();
let failed = false;
for (const file of files) {
  const slug = slugOf(file);
  if (!/^[a-z0-9_]+$/.test(slug)) {
    console.error("[skip] %s: unusable agent name %o", file, slug);
    failed = true;
    continue;
  }
  if (seen.has(slug)) {
    console.warn("[skip] %s: %s already converted in this run", file, slug);
    continue;
  }
  seen.add(slug);
  try {
    const { width, height, quality } = SIZE;
    const { size } = await sharp(file)
      .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality })
      .toFile(join(outDir, `${slug}.webp`));
    console.log("[ok] %s -> %s.webp (%d KB)", file, slug, Math.round(size / 1024));
  } catch (error) {
    console.error("[error] %s", file, error);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
