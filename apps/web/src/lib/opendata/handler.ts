/**
 * GC-Stats - opendata handler
 *
 * Single entry point of every OpenData API call. Order matters, cheapest
 * checks first: kill switch, params, shed under critical load when the answer
 * is not cached, account, rate limit (on the OpenData pool), cache,
 * concurrency gate, query. Every call is logged for /admin/settings/opendata.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getClientIp } from "@/lib/client-ip";
import { openDataDb } from "@gc-stats/db/client";
import { INTEGER_FILTER_PATTERN } from "@/lib/column-filter";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOpenDataConfig } from "./config";
import { OPENDATA_BROWSE_WINDOW_MS, OPENDATA_EXPORT_WINDOW_MS } from "./config-shared";
import { OpenDataCache } from "./cache";
import { acquireSlot, currentPressure } from "./pressure";
import { hashClient, recordOpenDataRequest, type OpenDataOutcome } from "./metrics";
import { queryOpenDataCounts, queryOpenDataExport, queryOpenDataPage, type OpenDataPageQuery } from "./datasets";
import {
  OPENDATA_DATASET_META,
  OPENDATA_DEFAULT_PAGE_SIZE,
  OPENDATA_FILTER_PREFIX,
  OPENDATA_LIST_VALUES,
  OPENDATA_MAX_FILTERS,
  OPENDATA_MAX_QUERY_LENGTH,
  OPENDATA_PAGE_SIZES,
  isIntegerColumnType,
  openDataExportFileName,
  isOpenDataDataset,
  type OpenDataDataset,
  type OpenDataErrorCode,
  type OpenDataFilter,
  type OpenDataPageResponse,
  type OpenDataRequestKind,
  type OpenDataRow,
} from "./datasets-meta";

const BROWSE_TTL_MS = 60_000;
const EXPORT_TTL_MS = 10 * 60_000;
const COUNTS_TTL_MS = 10 * 60_000;
const SHED_RETRY_AFTER_S = 30;
const MAX_PAGE = 100_000;

type BrowseValue = { rows: OpenDataRow[]; total: number };

declare global {
  // eslint-disable-next-line no-var
  var __gcsOpenDataCaches:
    | { browse: OpenDataCache<BrowseValue>; export: OpenDataCache<string>; counts: OpenDataCache<Record<OpenDataDataset, number>> }
    | undefined;
}

function caches() {
  globalThis.__gcsOpenDataCaches ??= {
    browse: new OpenDataCache<BrowseValue>(500, 64 * 1024 * 1024, (v) => JSON.stringify(v.rows).length),
    export: new OpenDataCache<string>(32, 256 * 1024 * 1024, (v) => v.length),
    counts: new OpenDataCache<Record<OpenDataDataset, number>>(1, 1024, () => 1),
  };
  return globalThis.__gcsOpenDataCaches;
}

class OpenDataShedError extends Error {}

/** Runs a query inside a gate slot, throws OpenDataShedError when the site needs the capacity. */
async function gated<T>(run: () => Promise<T>, onQueue: (ms: number) => void): Promise<T> {
  const slot = await acquireSlot();
  if (!slot) throw new OpenDataShedError();
  onQueue(slot.queueMs);
  try {
    return await run();
  } finally {
    slot.release();
  }
}

/** Dataset counts for the portal home page, cached and gated like the API. `null` while shed. */
export async function getOpenDataCounts(): Promise<Record<OpenDataDataset, number> | null> {
  try {
    const { value } = await caches().counts.getOrLoad("counts", COUNTS_TTL_MS, () => gated(queryOpenDataCounts, () => {}));
    return value;
  } catch (error) {
    if (error instanceof OpenDataShedError) return null;
    console.error("[opendata] counts query failed", error);
    return null;
  }
}

type ParsedBrowse = { ok: true; query: OpenDataPageQuery } | { ok: false; field: string; message: string };

type ParsedSelection = { ok: true; q: string; filters: OpenDataFilter[] } | { ok: false; field: string; message: string };

/** Search and column filters, shared by the table and the export so a download matches what is shown. */
function parseSelection(dataset: OpenDataDataset, params: URLSearchParams): ParsedSelection {
  const meta = OPENDATA_DATASET_META[dataset];

  const q = (params.get("q") ?? "").trim();
  if (q.length > OPENDATA_MAX_QUERY_LENGTH) return { ok: false, field: "q", message: `q must be at most ${OPENDATA_MAX_QUERY_LENGTH} characters` };

  const filters: OpenDataFilter[] = [];
  for (const [name, raw] of params) {
    if (!name.startsWith(OPENDATA_FILTER_PREFIX)) continue;
    const key = name.slice(OPENDATA_FILTER_PREFIX.length);
    const column = meta.columns.find((c) => c.key === key);
    if (!column) return { ok: false, field: name, message: `filter column must be one of ${meta.columns.map((c) => c.key).join(", ")}` };
    const value = raw.trim();
    if (!value) continue;
    if (value.length > OPENDATA_MAX_QUERY_LENGTH) return { ok: false, field: name, message: `${name} must be at most ${OPENDATA_MAX_QUERY_LENGTH} characters` };
    const listed = OPENDATA_LIST_VALUES[column.type];
    if (listed && !listed.includes(value)) return { ok: false, field: name, message: `${name} must be one of ${listed.join(", ")}` };
    if (isIntegerColumnType(column.type) && !INTEGER_FILTER_PATTERN.test(value)) return { ok: false, field: name, message: `${name} must be a whole number` };
    filters.push({ column: key, value });
  }
  if (filters.length > OPENDATA_MAX_FILTERS) return { ok: false, field: "filters", message: `at most ${OPENDATA_MAX_FILTERS} filters` };

  return { ok: true, q, filters };
}

/** Stable cache key part for a selection, whatever the param order or case. */
function selectionKey(q: string, filters: OpenDataFilter[]): [string, string[]] {
  return [q.toLowerCase(), filters.map((f) => `${f.column}=${f.value.toLowerCase()}`).sort()];
}

export function parseBrowseQuery(dataset: OpenDataDataset, params: URLSearchParams): ParsedBrowse {
  const meta = OPENDATA_DATASET_META[dataset];

  const pageRaw = params.get("page") ?? "1";
  const page = Number(pageRaw);
  if (!/^\d+$/.test(pageRaw) || page < 1 || page > MAX_PAGE) return { ok: false, field: "page", message: `page must be an integer between 1 and ${MAX_PAGE}` };

  const perPageRaw = params.get("per_page") ?? String(OPENDATA_DEFAULT_PAGE_SIZE);
  const perPage = Number(perPageRaw);
  if (!(OPENDATA_PAGE_SIZES as readonly number[]).includes(perPage)) return { ok: false, field: "per_page", message: `per_page must be one of ${OPENDATA_PAGE_SIZES.join(", ")}` };

  const sort = params.get("sort") ?? meta.defaultSort;
  if (!meta.columns.some((c) => c.key === sort)) return { ok: false, field: "sort", message: `sort must be one of ${meta.columns.map((c) => c.key).join(", ")}` };

  const direction = params.get("direction") ?? (params.has("sort") ? "asc" : meta.defaultDirection);
  if (direction !== "asc" && direction !== "desc") return { ok: false, field: "direction", message: "direction must be asc or desc" };

  const selection = parseSelection(dataset, params);
  if (!selection.ok) return selection;
  const { q, filters } = selection;

  return { ok: true, query: { dataset, page, perPage, sort, direction, q, filters } };
}

function errorResponse(code: OpenDataErrorCode, status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json({ error: code, ...extra }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function hasSessionCookie(request: Request): boolean {
  return (request.headers.get("cookie") ?? "").includes("authjs.session-token");
}

type HandlerResult = { body: string; rowCount: number; cacheHit: boolean; headers?: Record<string, string> };

/**
 * Shared wrapper of the OpenData routes. `cacheKey` lets a critical load still
 * serve answers already in memory; `load` runs only on a miss and must call
 * the query through `gated`.
 */
async function withOpenData(
  request: Request,
  datasetParam: string,
  kind: OpenDataRequestKind,
  prepare: (dataset: OpenDataDataset) => { ok: true; cacheKey: string; load: (onQueue: (ms: number) => void) => Promise<HandlerResult> } | { ok: false; response: NextResponse },
): Promise<NextResponse> {
  const startedAt = Date.now();
  const pressure = currentPressure();
  const clientHash = hashClient(getClientIp(request.headers));
  let userId: string | null = null;
  let queueMs = 0;

  const log = (dataset: OpenDataDataset, outcome: OpenDataOutcome, statusCode: number, cacheHit = false, rowCount = 0) =>
    recordOpenDataRequest({ dataset, kind, outcome, statusCode, durationMs: Date.now() - startedAt, queueMs, cacheHit, rowCount, userId, clientHash, pressure });

  if (!isOpenDataDataset(datasetParam)) return errorResponse("not_found", 404, { datasets: Object.keys(OPENDATA_DATASET_META) });
  const dataset = datasetParam;

  const config = await getOpenDataConfig();
  if (!config.enabled) {
    log(dataset, "disabled", 503);
    return errorResponse("disabled", 503);
  }

  const prepared = prepare(dataset);
  if (!prepared.ok) {
    log(dataset, "bad_request", prepared.response.status);
    return prepared.response;
  }

  const cache = kind === "browse" ? caches().browse : caches().export;
  if (pressure === "critical" && !cache.has(prepared.cacheKey)) {
    log(dataset, "shed", 503);
    return errorResponse("busy", 503, {}, { "Retry-After": String(SHED_RETRY_AFTER_S) });
  }

  // auth() reads the user on the main pool: optional sessions are only resolved under normal load.
  if (config.requireAccount || (pressure === "normal" && hasSessionCookie(request))) {
    userId = (await auth())?.user?.id ?? null;
  }
  if (config.requireAccount && !userId) {
    log(dataset, "auth_required", 401);
    return errorResponse("account_required", 401);
  }

  const limit = kind === "browse" ? config.browsePerMinute : config.exportsPerHour;
  const windowMs = kind === "browse" ? OPENDATA_BROWSE_WINDOW_MS : OPENDATA_EXPORT_WINDOW_MS;
  const rateHeaders = { "X-RateLimit-Limit": String(limit), "X-RateLimit-Window": String(windowMs / 1000) };
  if (!(await checkRateLimit(`opendata:${kind}:${userId ?? clientHash}`, windowMs, limit, 1, openDataDb))) {
    log(dataset, "rate_limited", 429);
    return errorResponse("rate_limited", 429, { limit, window_seconds: windowMs / 1000 }, { ...rateHeaders, "Retry-After": String(windowMs / 1000) });
  }

  try {
    const result = await prepared.load((ms) => (queueMs = ms));
    log(dataset, "ok", 200, result.cacheHit, result.rowCount);
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": config.requireAccount ? "private, no-store" : `public, max-age=${(kind === "browse" ? BROWSE_TTL_MS : EXPORT_TTL_MS) / 1000}`,
        "X-OpenData-Cache": result.cacheHit ? "HIT" : "MISS",
        ...(config.requireAccount ? {} : { "Access-Control-Allow-Origin": "*" }),
        ...rateHeaders,
        ...result.headers,
      },
    });
  } catch (error) {
    if (error instanceof OpenDataShedError) {
      log(dataset, "shed", 503);
      return errorResponse("busy", 503, {}, { "Retry-After": String(SHED_RETRY_AFTER_S) });
    }
    console.error("[opendata] %s %s failed", kind, dataset, error);
    log(dataset, "error", 500);
    return errorResponse("internal_error", 500);
  }
}

export function handleOpenDataBrowse(request: Request, datasetParam: string): Promise<NextResponse> {
  return withOpenData(request, datasetParam, "browse", (dataset) => {
    const parsed = parseBrowseQuery(dataset, new URL(request.url).searchParams);
    if (!parsed.ok) return { ok: false, response: errorResponse("bad_request", 400, { field: parsed.field, message: parsed.message }) };
    const { query } = parsed;
    const cacheKey = JSON.stringify([query.dataset, query.sort, query.direction, query.page, query.perPage, ...selectionKey(query.q, query.filters)]);

    return {
      ok: true,
      cacheKey,
      load: async (onQueue) => {
        const { value, hit } = await caches().browse.getOrLoad(cacheKey, BROWSE_TTL_MS, () => gated(() => queryOpenDataPage(query), onQueue));
        const response: OpenDataPageResponse = {
          dataset: query.dataset,
          page: query.page,
          per_page: query.perPage,
          total: value.total,
          total_pages: Math.max(1, Math.ceil(value.total / query.perPage)),
          sort: query.sort,
          direction: query.direction,
          q: query.q,
          filters: query.filters,
          generated_at: new Date().toISOString(),
          data: value.rows,
        };
        return { body: JSON.stringify(response), rowCount: value.rows.length, cacheHit: hit };
      },
    };
  });
}

export function handleOpenDataExport(request: Request, datasetParam: string): Promise<NextResponse> {
  return withOpenData(request, datasetParam, "export", (dataset) => {
    const selection = parseSelection(dataset, new URL(request.url).searchParams);
    if (!selection.ok) return { ok: false, response: errorResponse("bad_request", 400, { field: selection.field, message: selection.message }) };
    const { q, filters } = selection;
    const filtered = q !== "" || filters.length > 0;
    const cacheKey = JSON.stringify([dataset, ...selectionKey(q, filters)]);

    return {
      ok: true,
      cacheKey,
      load: async (onQueue) => {
        const { value, hit } = await caches().export.getOrLoad(cacheKey, EXPORT_TTL_MS, async () => {
          const rows = await gated(() => queryOpenDataExport(dataset, q, filters), onQueue);
          const source = `${process.env.SITE_URL ?? ""}/opendata/${dataset}`;
          // count stays ahead of the selection, it is read back from the first bytes below.
          return JSON.stringify({ dataset, generated_at: new Date().toISOString(), source, count: rows.length, ...(filtered ? { q, filters } : {}), data: rows });
        });
        const date = new Date().toISOString().slice(0, 10);
        const countMatch = /"count":(\d+)/.exec(value.slice(0, 512));
        return {
          body: value,
          rowCount: countMatch ? Number(countMatch[1]) : 0,
          cacheHit: hit,
          headers: { "Content-Disposition": `attachment; filename="${openDataExportFileName(dataset, filtered, date)}"` },
        };
      },
    };
  });
}
