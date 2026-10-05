/**
 * GC-Stats - load-messages (Cloudflare)
 *
 * Bundling every locale's JSON made up ~40% of the Worker script and pushed
 * isolates past their memory limit. Messages are shipped as static assets
 * instead (scripts/copy-messages-assets.mjs) and fetched through the ASSETS
 * binding, once per locale per isolate.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AbstractIntlMessages } from "next-intl";
import type { AppLocale } from "./routing";

const MESSAGES_ASSETS_PATH = "/_gcs/messages";

// On globalThis so the RSC, SSR and route handler module copies share one cache.
const CACHE_KEY = Symbol.for("gcs.i18n.messages");
const g = globalThis as typeof globalThis & { [CACHE_KEY]?: Map<string, Promise<AbstractIntlMessages>> };
const cache = (g[CACHE_KEY] ??= new Map());

async function fetchFromAssets(locale: AppLocale): Promise<AbstractIntlMessages> {
  let assets: Fetcher | undefined;
  try {
    assets = getCloudflareContext().env.ASSETS;
  } catch {
    // `next build` prerendering, outside any Worker request.
  }

  if (!assets) {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    return JSON.parse(await readFile(path.join(process.cwd(), "src/messages", `${locale}.json`), "utf8"));
  }

  const response = await assets.fetch(new URL(`${MESSAGES_ASSETS_PATH}/${locale}.json`, "https://assets.local"));
  if (!response.ok) throw new Error(`[i18n] messages for "${locale}" not found (${response.status})`);
  return response.json();
}

export function loadMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = fetchFromAssets(locale);
    // A failed load must not stick for the isolate's lifetime.
    pending.catch(() => cache.delete(locale));
    cache.set(locale, pending);
  }
  return pending;
}
