/**
 * GC-Stats - liquipedia-api
 *
 * Reads raw wikitext from the Liquipedia MediaWiki API. Follows the API terms:
 * identified User-Agent, one request every 2 seconds at most, titles batched
 * in a single request, and never `action=parse`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import packageJson from "../../package.json";

const API_URL = "https://liquipedia.net/valorant/api.php";
const USER_AGENT = process.env.GCS_LIQUIPEDIA_USER_AGENT ?? `GC-Stats/${packageJson.version} (https://github.com/Osthelia/GC-Stats-Website)`;
const MAX_TITLES_PER_REQUEST = 50;
const MIN_INTERVAL_MS = 2000;
const FETCH_TIMEOUT_MS = 15000;

export type LiquipediaPage = {
  /** Title as written in the request. */
  requested: string;
  /** Canonical title after normalisation and redirects, null when the page does not exist. */
  title: string | null;
  wikitext: string | null;
};

let lastRequestAt = 0;

/** Reserves the next slot before waiting, so concurrent callers queue instead of firing together. */
async function throttle(): Promise<void> {
  const slot = Math.max(Date.now(), lastRequestAt + MIN_INTERVAL_MS);
  lastRequestAt = slot;
  const wait = slot - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

/** `https://liquipedia.net/valorant/Some_Page` -> `Some Page`; plain names are returned as is. */
export function liquipediaTitleFromLink(linkOrName: string): string {
  const trimmed = linkOrName.trim();
  const match = trimmed.match(/liquipedia\.net\/valorant\/([^?#]+)/i);
  const raw = match?.[1] ?? trimmed;
  try {
    return decodeURIComponent(raw).replaceAll("_", " ");
  } catch {
    return raw.replaceAll("_", " ");
  }
}

type ApiResponse = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title: string; missing?: string; revisions?: { slots?: { main?: { "*"?: string; content?: string } } }[] }>;
  };
};

async function fetchBatch(titles: string[]): Promise<LiquipediaPage[]> {
  await throttle();
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
    format: "json",
    formatversion: "1",
    titles: titles.join("|"),
  });
  const response = await fetch(`${API_URL}?${params}`, { headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Liquipedia API responded ${response.status}`);
  const data = (await response.json()) as ApiResponse;

  // requested -> normalised -> redirect target
  const hop = new Map<string, string>();
  for (const entry of data.query?.normalized ?? []) hop.set(entry.from, entry.to);
  const redirect = new Map((data.query?.redirects ?? []).map((entry) => [entry.from, entry.to]));
  const byTitle = new Map(Object.values(data.query?.pages ?? {}).map((page) => [page.title, page]));

  return titles.map((requested) => {
    const normalized = hop.get(requested) ?? requested;
    const finalTitle = redirect.get(normalized) ?? normalized;
    const page = byTitle.get(finalTitle);
    const slot = page?.revisions?.[0]?.slots?.main;
    const wikitext = page && page.missing === undefined ? (slot?.["*"] ?? slot?.content ?? null) : null;
    return { requested, title: wikitext === null ? null : finalTitle, wikitext };
  });
}

/** Fetches the wikitext of every title, 50 per request. Throws when Liquipedia is unreachable. */
export async function fetchLiquipediaPages(titles: string[]): Promise<LiquipediaPage[]> {
  const unique = [...new Set(titles.map((t) => t.trim()).filter((t) => t.length > 0))];
  const result: LiquipediaPage[] = [];
  for (let i = 0; i < unique.length; i += MAX_TITLES_PER_REQUEST) {
    result.push(...(await fetchBatch(unique.slice(i, i + MAX_TITLES_PER_REQUEST))));
  }
  return result;
}
