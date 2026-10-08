/**
 * GC-Stats - widget-api
 *
 * Shared helpers for the public widget data endpoints (/api/widgets/*):
 * open CORS (any site can host a widget), short cache, JSON errors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import type { WidgetSearchParams } from "@/lib/widget-params";

export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const CACHE_HEADER = "public, s-maxage=300, stale-while-revalidate=60";

export function widgetJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { ...CORS_HEADERS, "Cache-Control": status === 200 ? CACHE_HEADER : "no-store" } });
}

export function widgetError(status: number, message: string): NextResponse {
  return widgetJson({ error: message }, status);
}

export function widgetPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" } });
}

/** Query string to the plain record the widget param parsers expect. */
export function searchParamsToRecord(searchParams: URLSearchParams): WidgetSearchParams {
  const record: WidgetSearchParams = {};
  for (const [key, value] of searchParams) record[key] = value;
  return record;
}

/** Inclusive day bounds from a `YYYY-MM-DD` date. */
export function parseDateBound(date: string | null, endOfDay: boolean): Date | undefined {
  if (!date) return undefined;
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Precise error for a malformed date param, null when valid or absent. */
export function dateParamError(searchParams: URLSearchParams, name: string): string | null {
  const raw = searchParams.get(name);
  if (!raw || DATE_RE.test(raw)) return null;
  return `Invalid "${name}": expected YYYY-MM-DD`;
}

/** Precise error for a malformed integer param, null when valid or absent. */
export function intParamError(searchParams: URLSearchParams, name: string): string | null {
  const raw = searchParams.get(name);
  if (!raw) return null;
  return /^\d+$/.test(raw) ? null : `Invalid "${name}": expected a positive integer`;
}
