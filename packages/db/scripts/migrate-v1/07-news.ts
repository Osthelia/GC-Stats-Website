/**
 * GC-Stats — 07-news
 *
 * V1 to V2 migration step: migrates news authors, articles, and their
 * entity relations. News authors are left without a linked user, since
 * accounts get recreated fresh rather than ported over.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db, v1 } from "./connection";
import { getMappedId, batchInsert, preloadEntityType } from "./id-map";
import { newsAuthors, news, newsRelations } from "../../src/schema";
import { convertSocials } from "./social-links";

function parseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === "object") return val as T;
  try { return JSON.parse(val as string); } catch { return fallback; }
}

// news_authors.user_id would reference V2 `users`, but this migration
// deliberately does not port V1 accounts over (decided with the user —
// accounts get recreated fresh) — left null for every migrated author.
export async function migrateNewsAuthors() {
  const [rows] = await v1.query<any[]>("SELECT id, name, slug, bio, socials FROM news_authors");
  const { created, skipped } = await batchInsert(
    "news_author",
    rows as any[],
    (row) => row.id,
    (row) => ({ name: row.name, slug: row.slug, bio: row.bio, socials: convertSocials(parseJson(row.socials, {})) }),
    (tx, values) => tx.insert(newsAuthors).values(values as any).returning({ id: newsAuthors.id }),
  );
  console.log(`news_authors: ${created} created, ${skipped} already migrated`);
}

export async function migrateNews() {
  await preloadEntityType("news_author");
  await preloadEntityType("news_publisher");
  const [rows] = await v1.query<any[]>(
    `SELECT id, author_id, publisher_id, lang, title, slug, excerpt, content, image_cover,
            status, is_featured, show_on_home, published_at
     FROM news`
  );
  const CHUNK = 500;
  let created = 0, skipped = 0;
  for (let i = 0; i < (rows as any[]).length; i += CHUNK) {
    const chunk = (rows as any[]).slice(i, i + CHUNK);
    const toInsert: { legacyId: number; value: Record<string, unknown> }[] = [];
    for (const row of chunk) {
      if (await getMappedId("news", row.id)) { skipped++; continue; }
      const authorId = row.author_id ? (await getMappedId("news_author", row.author_id)) ?? null : null;
      const organizationId = row.publisher_id ? (await getMappedId("news_publisher", row.publisher_id)) ?? null : null;
      toInsert.push({
        legacyId: row.id,
        value: {
          authorId, organizationId, lang: row.lang, title: row.title, slug: row.slug,
          excerpt: row.excerpt, content: row.content, imageCover: row.image_cover,
          status: row.status, isFeatured: !!row.is_featured, showOnHome: !!row.show_on_home,
          publishedAt: row.published_at,
        },
      });
    }
    if (toInsert.length === 0) continue;
    const inserted = await db.insert(news).values(toInsert.map((t) => t.value) as any).returning({ id: news.id });
    const { setMappedIdsBatch } = await import("./id-map");
    await setMappedIdsBatch("news", toInsert.map((t, idx) => ({ legacyId: t.legacyId, newId: inserted[idx].id })));
    created += toInsert.length;
  }
  console.log(`news: ${created} created, ${skipped} already migrated`);
}

export async function migrateNewsRelations() {
  await preloadEntityType("news");
  await preloadEntityType("team");
  await preloadEntityType("tournament");
  const [rows] = await v1.query<any[]>(
    "SELECT id, news_id, relationable_type, relationable_id FROM news_relations"
  );
  let created = 0, skipped = 0, unresolved = 0;
  for (const row of rows as any[]) {
    if (await getMappedId("news_relation", row.id)) { skipped++; continue; }
    const newsId = await getMappedId("news", row.news_id);
    const relatableType = row.relationable_type === "team" ? "team" : row.relationable_type === "tournament" ? "tournament" : null;
    const relatableId = relatableType ? await getMappedId(relatableType, row.relationable_id) : undefined;
    if (!newsId || !relatableType || !relatableId) { unresolved++; continue; }
    const [inserted] = await db.insert(newsRelations).values({ newsId, relatableType, relatableId }).returning({ id: newsRelations.id });
    const { setMappedId } = await import("./id-map");
    await setMappedId("news_relation", row.id, inserted.id);
    created++;
  }
  console.log(`news_relations: ${created} created, ${skipped} already migrated, ${unresolved} unresolved`);
}
