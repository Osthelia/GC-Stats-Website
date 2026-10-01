/**
 * GC-Stats - generate-logo
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

// Génère le logo "GC" (navbar/favicon) en SVG + PNG.
// Usage : node generate-logo.mjs [--out dossier] [--sizes 64,256,512] [--bg #e4ae22] [--fg #0e0e0e]

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);

const outDir = resolve(args.out ?? "logo");
const sizes = (args.sizes ?? "32,64,128,180,256,512,1024").split(",").map(Number);
const bg = args.bg ?? "#e4ae22";
const fg = args.fg ?? "#0e0e0e";

if (sizes.some((s) => !Number.isInteger(s) || s <= 0)) {
  console.error("--sizes doit être une liste d'entiers positifs, ex : 64,256,512");
  process.exit(1);
}

// Même tracé que apps/web/public/favicon.svg
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="19" fill="${bg}"/>
  <text x="32" y="43" text-anchor="middle" font-family="Arial, sans-serif" font-size="27" font-weight="700" letter-spacing="-1" fill="${fg}">GC</text>
</svg>
`;

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "gc-stats-logo.svg"), svg);

for (const size of sizes) {
  await sharp(Buffer.from(svg), { density: Math.max(72, (72 * size) / 64) })
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, `gc-stats-logo-${size}.png`));
}

console.log(`Logo généré dans ${outDir} (svg + ${sizes.map((s) => `${s}px`).join(", ")})`);
