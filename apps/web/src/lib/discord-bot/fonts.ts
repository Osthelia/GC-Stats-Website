/**
 * GC-Stats - fonts
 *
 * Loads the font library (@fontsource woff files) for the image renderer.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { TEMPLATE_FONTS, type TemplateFontId } from "./template";

export type RenderFont = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };

const cache = new Map<string, Promise<Buffer>>();

// Resolved at runtime from the app root, the files are traced by next.config (outputFileTracingIncludes).
const appRequire = createRequire(path.join(process.cwd(), "package.json"));

function loadFile(pkg: string, weight: number): Promise<Buffer> {
  const key = `${pkg}:${weight}`;
  let loaded = cache.get(key);
  if (!loaded) {
    const dir = path.dirname(appRequire.resolve(`@fontsource/${pkg}/package.json`));
    loaded = readFile(path.join(dir, "files", `${pkg}-latin-${weight}-normal.woff`));
    // A failed read must not stay cached.
    loaded.catch(() => cache.delete(key));
    cache.set(key, loaded);
  }
  return loaded;
}

/** The weights of the given fonts, ready for Satori. */
export async function loadRenderFonts(fontIds: Iterable<TemplateFontId>): Promise<RenderFont[]> {
  const wanted = new Set(fontIds);
  wanted.add("inter");
  const fonts: RenderFont[] = [];
  for (const font of TEMPLATE_FONTS.filter((f) => wanted.has(f.id))) {
    for (const weight of font.weights) {
      fonts.push({ name: font.name, data: await loadFile(font.pkg, weight), weight, style: "normal" });
    }
  }
  return fonts;
}
