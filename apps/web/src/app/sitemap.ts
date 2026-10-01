/**
 * GC-Stats - sitemap
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { tournaments, teams, people, news } from "@gc-stats/db";
import { visibleTeam, visiblePerson, visibleTournament } from "@/lib/ghost-visibility";
import { slugify } from "@/lib/entity-id";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { routing } from "@/i18n/routing";

/**
 * Native Next.js sitemap (replaces V1's sitemap:generate cron — no
 * scheduling needed, this route is computed fresh on every crawl request).
 * Individual matches are deliberately excluded, tens of thousands of them
 * would blow crawl budget for no SEO benefit (mirrors V1). Inactive
 * tournaments, teams and players are excluded too.
 *
 * Split into multiple sitemap files via generateSitemaps: Google rejects a
 * sitemap once it passes 50,000 URLs, and CHUNK_SIZE keeps each file well
 * under that so the site keeps working as the database grows.
 */

const CHUNK_SIZE = 5000;
// generateSitemaps runs during `next build`'s page data collection, where the
// DB is never reachable (see next.config.mjs's DEPLOY_TARGET comment) — so
// chunk ids are overprovisioned instead of counted. A chunk beyond the real
// row count just renders an empty (still valid) sitemap file.
const MAX_CHUNKS_PER_SECTION = 40;

const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/tournaments", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "daily" },
  { path: "/transparency", priority: 0.5, changeFrequency: "daily" },
  { path: "/finance", priority: 0.5, changeFrequency: "daily" },
  { path: "/data", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal", priority: 0.2, changeFrequency: "yearly" },
  { path: "/takedown", priority: 0.2, changeFrequency: "yearly" },
  { path: "/help/add_tournament", priority: 0.2, changeFrequency: "yearly" },
  { path: "/help/edit_page", priority: 0.2, changeFrequency: "yearly" },
];

export const dynamic = "force-dynamic";

type Section = "tournaments" | "teams" | "players" | "news";

export function generateSitemaps(): Array<{ id: string }> {
  const ids = ["static"];
  const sections: Section[] = ["tournaments", "teams", "players", "news"];
  for (const section of sections) {
    for (let i = 0; i < MAX_CHUNKS_PER_SECTION; i++) ids.push(`${section}-${i}`);
  }

  return ids.map((id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const resolvedId = await id;
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const localize = (path: string) => localizedEntry(base, path);

  if (resolvedId === "static") {
    return STATIC_PATHS.map(({ path, priority, changeFrequency }) => ({ ...localize(path), priority, changeFrequency }));
  }

  const separatorIndex = resolvedId.lastIndexOf("-");
  const section = resolvedId.slice(0, separatorIndex) as Section;
  const offset = Number(resolvedId.slice(separatorIndex + 1)) * CHUNK_SIZE;

  switch (section) {
    case "tournaments": {
      const rows = await db
        .select({ id: tournaments.id, name: tournaments.name })
        .from(tournaments)
        .where(and(eq(tournaments.active, true), visibleTournament))
        .orderBy(tournaments.id)
        .limit(CHUNK_SIZE)
        .offset(offset);
      return rows.map((t) => ({ ...localize(`/tournaments/${t.id}/${slugify(t.name)}`), priority: 0.9, changeFrequency: "weekly" as const }));
    }
    case "teams": {
      const rows = await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(and(eq(teams.isActive, true), visibleTeam))
        .orderBy(teams.id)
        .limit(CHUNK_SIZE)
        .offset(offset);
      return rows.map((t) => ({ ...localize(`/team/${t.id}/${slugify(t.name)}`), priority: 0.6, changeFrequency: "weekly" as const }));
    }
    case "players": {
      const rows = await db
        .select({ id: people.id, handle: people.handle })
        .from(people)
        .where(and(eq(people.isActive, true), visiblePerson))
        .orderBy(people.id)
        .limit(CHUNK_SIZE)
        .offset(offset);
      return rows.map((p) => ({ ...localize(`/player/${p.id}/${slugify(p.handle)}`), priority: 0.6, changeFrequency: "weekly" as const }));
    }
    case "news": {
      const rows = await db
        .select({ slug: news.slug, publishedAt: news.publishedAt })
        .from(news)
        .where(isNewsPublishedCondition())
        .orderBy(news.slug)
        .limit(CHUNK_SIZE)
        .offset(offset);
      return rows.map((n) => ({ ...localize(`/news/${n.slug}`), priority: 0.7, changeFrequency: "monthly" as const, lastModified: n.publishedAt ?? undefined }));
    }
    default:
      return [];
  }
}

/** One sitemap entry per path, `url` on the default locale plus `alternates.languages` for every other locale (localePrefix is "always", see i18n/routing.ts). */
function localizedEntry(base: string, path: string): { url: string; alternates: { languages: Record<string, string> } } {
  const languages = Object.fromEntries(routing.locales.map((locale) => [locale, `${base}/${locale}${path}`]));
  return { url: `${base}/${routing.defaultLocale}${path}`, alternates: { languages } };
}
