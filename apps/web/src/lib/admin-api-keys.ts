/**
 * GC-Stats - admin-api-keys
 *
 * Admin queries for /admin/api-keys: lists and details for every API key
 * across every user and organization, with request counts and usage stats.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, apiRequestLog, users, organizations } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";
import { getApiKeysOverview, type ApiKeysOverview } from "@/lib/api-key-stats";

export type ApiKeySort = "clientName" | "user" | "status";
export type SortDirection = "asc" | "desc";

export type AdminApiKeyRow = {
  id: number;
  clientName: string;
  keyHashPreview: string;
  rateLimit: number | null;
  isActive: boolean;
  /** Exactly one of the two owner fields is set — a personal key (userId) or an org-scoped one created from /dashboard (organizationId). */
  userId: string | null;
  username: string | null;
  email: string | null;
  organizationId: number | null;
  organizationName: string | null;
  requestCount: number;
};

async function withRequestCounts(rows: Omit<AdminApiKeyRow, "requestCount">[]): Promise<AdminApiKeyRow[]> {
  if (rows.length === 0) return [];
  const counts = await db
    .select({ apiKeyId: apiRequestLog.apiKeyId, requestCount: count() })
    .from(apiRequestLog)
    .where(inArray(apiRequestLog.apiKeyId, rows.map((r) => r.id)))
    .groupBy(apiRequestLog.apiKeyId);
  const byKey = new Map(counts.map((c) => [c.apiKeyId, Number(c.requestCount)]));
  return rows.map((r) => ({ ...r, requestCount: byKey.get(r.id) ?? 0 }));
}

export const API_KEYS_PAGE_SIZE = 30;

/** All API keys across every user AND every organization — /admin/api-keys. Personal keys are created from the owning user's admin page; org-scoped keys are created from /dashboard, this is read-only for those. */
export async function listAdminApiKeys(opts: { q: string; sort: ApiKeySort; direction: SortDirection; page: number }): Promise<{ rows: AdminApiKeyRow[]; total: number }> {
  const { q, sort, direction, page } = opts;
  const conditions = [];

  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(apiKeys.clientName, v), foldedIlike(users.username, v), foldedIlike(organizations.name, v)]);
    if (numeric) clauses.push(eq(apiKeys.id, Number(q)));
    conditions.push(or(...clauses));
  }

  const ownerNameCol = sql<string>`coalesce(${users.username}, ${organizations.name})`;
  const sortCol = sort === "user" ? ownerNameCol : sort === "status" ? apiKeys.isActive : apiKeys.clientName;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);
  const where = conditions.length ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: apiKeys.id,
      clientName: apiKeys.clientName,
      keyHash: apiKeys.keyHash,
      rateLimit: apiKeys.rateLimit,
      isActive: apiKeys.isActive,
      userId: apiKeys.userId,
      username: users.username,
      email: users.email,
      organizationId: apiKeys.organizationId,
      organizationName: organizations.name,
    })
    .from(apiKeys)
    .leftJoin(users, eq(users.id, apiKeys.userId))
    .leftJoin(organizations, eq(organizations.id, apiKeys.organizationId))
    .where(where)
    .orderBy(orderBy)
    .limit(API_KEYS_PAGE_SIZE)
    .offset((page - 1) * API_KEYS_PAGE_SIZE);

  const [rows, totalRows] = await Promise.all([
    baseQuery,
    db
      .select({ total: sql<number>`count(*)` })
      .from(apiKeys)
      .leftJoin(users, eq(users.id, apiKeys.userId))
      .leftJoin(organizations, eq(organizations.id, apiKeys.organizationId))
      .where(where),
  ]);

  const rowsWithCounts = await withRequestCounts(rows.map((r) => ({ ...r, keyHashPreview: r.keyHash.slice(0, 10) })));
  return { rows: rowsWithCounts, total: Number(totalRows[0]?.total ?? 0) };
}

/** Global "developer dashboard" summary across every active key, any owner — /admin/api-keys' equivalent of the per-organization overview on /dashboard. */
export async function getGlobalApiKeysOverview(): Promise<ApiKeysOverview> {
  const activeRows = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.isActive, true));
  return getApiKeysOverview(activeRows.map((r) => r.id));
}

export async function getAdminApiKey(id: number): Promise<AdminApiKeyRow | null> {
  const [row] = await db
    .select({
      id: apiKeys.id,
      clientName: apiKeys.clientName,
      keyHash: apiKeys.keyHash,
      rateLimit: apiKeys.rateLimit,
      isActive: apiKeys.isActive,
      userId: apiKeys.userId,
      username: users.username,
      email: users.email,
      organizationId: apiKeys.organizationId,
      organizationName: organizations.name,
    })
    .from(apiKeys)
    .leftJoin(users, eq(users.id, apiKeys.userId))
    .leftJoin(organizations, eq(organizations.id, apiKeys.organizationId))
    .where(eq(apiKeys.id, id))
    .limit(1);
  if (!row) return null;
  return { ...row, keyHashPreview: row.keyHash.slice(0, 10), requestCount: 0 };
}

export async function listUserApiKeys(userId: string): Promise<AdminApiKeyRow[]> {
  const rows = await db
    .select({
      id: apiKeys.id,
      clientName: apiKeys.clientName,
      keyHash: apiKeys.keyHash,
      rateLimit: apiKeys.rateLimit,
      isActive: apiKeys.isActive,
      userId: apiKeys.userId,
      username: users.username,
      email: users.email,
      organizationId: apiKeys.organizationId,
      organizationName: sql<string | null>`null`,
    })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(eq(apiKeys.userId, userId))
    .orderBy(asc(apiKeys.clientName));

  return withRequestCounts(rows.map((r) => ({ ...r, keyHashPreview: r.keyHash.slice(0, 10) })));
}
