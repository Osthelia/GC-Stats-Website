/**
 * GC-Stats - news-publish-condition
 *
 * Every public site query listing/reading news must use this instead of a
 * bare status check: an article's status flips to "published" immediately
 * once approved, but it must stay invisible until its scheduled publishedAt
 * time is actually due. Kept dependency-free to avoid circular imports.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, lte } from "drizzle-orm";
import { news } from "@gc-stats/db";

/**
 * Every public site query listing/reading news must use this instead of a
 * bare `eq(news.status, "published")` — a future news.publishedAt is how
 * "scheduled for later" is represented (see schema/content.ts's doc comment
 * on that column): status flips to 'published' immediately once approved,
 * but the article must stay invisible until its scheduled time is actually
 * due. Kept in its own file (no other imports) so every page module that
 * needs it can import it without risking a circular dependency.
 */
export function isNewsPublishedCondition() {
  return and(eq(news.status, "published"), lte(news.publishedAt, new Date()));
}
