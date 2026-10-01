/**
 * GC-Stats - production-list-params
 *
 * Shared `?sort=&dir=&role=&from=&to=&page=` parsing/href-building for the three
 * "Production" pages (org/tournament/player), same server-rendered-links
 * pattern as ListFilterDropdown/ListPagination, no client state.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export type ParsedProductionParams<Sort extends string> = {
  sort: Sort;
  direction: "asc" | "desc";
  page: number;
  role: string | null;
  /** YYYY-MM-DD, inclusive on both ends. */
  from: string | null;
  to: string | null;
};

type FilterParams = {
  role?: string | null;
  from?: string | null;
  to?: string | null;
};

const ROLE_MAX_LENGTH = 64;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | string[] | undefined): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  return DATE_RE.test(raw) && !Number.isNaN(Date.parse(`${raw}T00:00:00Z`))
    ? raw
    : null;
}

export function parseProductionParams<Sort extends string>(
  searchParams: Record<string, string | string[] | undefined>,
  sorts: readonly Sort[],
  defaultSort: Sort,
): ParsedProductionParams<Sort> {
  const rawSort =
    typeof searchParams.sort === "string" ? searchParams.sort : undefined;
  const sort =
    rawSort && (sorts as readonly string[]).includes(rawSort)
      ? (rawSort as Sort)
      : defaultSort;
  const direction: "asc" | "desc" = searchParams.dir === "asc" ? "asc" : "desc";
  const rawPage = Array.isArray(searchParams.page)
    ? searchParams.page[0]
    : searchParams.page;
  const page = Math.max(1, Number(rawPage) || 1);
  const rawRole =
    typeof searchParams.role === "string" ? searchParams.role.trim() : "";
  const role = rawRole && rawRole.length <= ROLE_MAX_LENGTH ? rawRole : null;
  return {
    sort,
    direction,
    page,
    role,
    from: parseDate(searchParams.from),
    to: parseDate(searchParams.to),
  };
}

export function buildProductionHref(
  basePath: string,
  params: {
    sort: string;
    direction: "asc" | "desc";
    page: number;
  } & FilterParams,
): string {
  const qs = new URLSearchParams();
  qs.set("sort", params.sort);
  qs.set("dir", params.direction);
  if (params.role) qs.set("role", params.role);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.page > 1) qs.set("page", String(params.page));
  return `${basePath}?${qs.toString()}`;
}

/** Href for a sort-column header: clicking an already-active column toggles direction, clicking another resets to a sensible default direction and page 1. */
export function sortColumnHref(
  basePath: string,
  current: ParsedProductionParams<string>,
  column: string,
  defaultDirection: "asc" | "desc" = "desc",
): string {
  const active = current.sort === column;
  const direction = active
    ? current.direction === "asc"
      ? "desc"
      : "asc"
    : defaultDirection;
  return buildProductionHref(basePath, {
    sort: column,
    direction,
    page: 1,
    role: current.role,
    from: current.from,
    to: current.to,
  });
}
