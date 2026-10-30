/**
 * GC-Stats - admin-public-api-keys
 *
 * Public (self service) API keys for /admin/api-keys/public: owner, usage,
 * suspension and the owner's API access block.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, apiRequestLog, users } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export const PUBLIC_API_KEY_STATUSES = ["active", "suspended", "revoked", "blocked"] as const;
export type PublicApiKeyStatusFilter = (typeof PUBLIC_API_KEY_STATUSES)[number];

export type AdminPublicApiKeyRow = {
  id: number;
  clientName: string;
  usageDescription: string | null;
  keyHashPreview: string;
  isActive: boolean;
  suspended: boolean;
  createdAt: string;
  userId: string | null;
  username: string | null;
  email: string | null;
  ownerBlocked: boolean;
  requests30d: number;
};

export const PUBLIC_API_KEYS_PAGE_SIZE = 20;

const STATUS_CLAUSE: Record<PublicApiKeyStatusFilter, SQL | undefined> = {
  active: and(eq(apiKeys.isActive, true), isNull(apiKeys.suspendedAt)),
  suspended: isNotNull(apiKeys.suspendedAt),
  revoked: and(eq(apiKeys.isActive, false), isNull(apiKeys.suspendedAt)),
  blocked: isNotNull(users.apiAccessBlockedAt),
};

const rowSelection = {
  id: apiKeys.id,
  clientName: apiKeys.clientName,
  usageDescription: apiKeys.usageDescription,
  keyHash: apiKeys.keyHash,
  isActive: apiKeys.isActive,
  suspendedAt: apiKeys.suspendedAt,
  createdAt: apiKeys.createdAt,
  userId: apiKeys.userId,
  username: users.username,
  email: users.email,
  blockedAt: users.apiAccessBlockedAt,
};

type RawRow = {
  id: number;
  clientName: string;
  usageDescription: string | null;
  keyHash: string;
  isActive: boolean;
  suspendedAt: Date | null;
  createdAt: Date;
  userId: string | null;
  username: string | null;
  email: string | null;
  blockedAt: Date | null;
};

async function withRequests(rows: RawRow[]): Promise<AdminPublicApiKeyRow[]> {
  const counts = rows.length
    ? await db
        .select({ apiKeyId: apiRequestLog.apiKeyId, total: sql<number>`count(*)::int` })
        .from(apiRequestLog)
        .where(and(inArray(apiRequestLog.apiKeyId, rows.map((r) => r.id)), gte(apiRequestLog.createdAt, sql`now() - interval '30 days'`)))
        .groupBy(apiRequestLog.apiKeyId)
    : [];
  const byKey = new Map(counts.map((c) => [c.apiKeyId, c.total]));
  return rows.map(({ keyHash, suspendedAt, createdAt, blockedAt, ...r }) => ({
    ...r,
    keyHashPreview: keyHash.slice(0, 10),
    suspended: suspendedAt !== null,
    createdAt: createdAt.toISOString(),
    ownerBlocked: blockedAt !== null,
    requests30d: byKey.get(r.id) ?? 0,
  }));
}

export async function listAdminPublicApiKeys(opts: { q: string; status: PublicApiKeyStatusFilter | null; page: number }): Promise<{ rows: AdminPublicApiKeyRow[]; total: number }> {
  const conditions: (SQL | undefined)[] = [eq(apiKeys.kind, "public")];
  if (opts.status) conditions.push(STATUS_CLAUSE[opts.status]);
  if (opts.q) {
    const variants = typoVariants(opts.q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(apiKeys.clientName, v), foldedIlike(apiKeys.usageDescription, v), foldedIlike(users.username, v), foldedIlike(users.email, v)]);
    if (/^\d+$/.test(opts.q)) clauses.push(eq(apiKeys.id, Number(opts.q)));
    conditions.push(or(...clauses));
  }
  const where = and(...conditions);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(rowSelection)
      .from(apiKeys)
      .leftJoin(users, eq(users.id, apiKeys.userId))
      .where(where)
      .orderBy(desc(apiKeys.createdAt))
      .limit(PUBLIC_API_KEYS_PAGE_SIZE)
      .offset((opts.page - 1) * PUBLIC_API_KEYS_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(apiKeys).leftJoin(users, eq(users.id, apiKeys.userId)).where(where),
  ]);
  return { rows: await withRequests(rows as RawRow[]), total: totalRow?.total ?? 0 };
}

export async function getAdminPublicApiKey(id: number): Promise<AdminPublicApiKeyRow | null> {
  const rows = await db
    .select(rowSelection)
    .from(apiKeys)
    .leftJoin(users, eq(users.id, apiKeys.userId))
    .where(and(eq(apiKeys.id, id), eq(apiKeys.kind, "public")))
    .limit(1);
  const [row] = await withRequests(rows as RawRow[]);
  return row ?? null;
}
