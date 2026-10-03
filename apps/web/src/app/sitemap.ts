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
import { tournaments, teams, news } from "@gc-stats/db";
import { visibleTeam, visibleTournament } from "@/lib/ghost-visibility";
import { slugify } from "@/lib/entity-id";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { routing } from "@/i18n/routing";

/**
 * Native Next.js sitemap served on /sitemap.xml (replaces V1's
 * sitemap:generate cron — computed fresh on every crawl request).
 * Mirrors V1's layout: static pages, every active tournament (with its
 * matches/stats tabs) and every active team. Players and individual matches
 * are deliberately excluded, tens of thousands of them would blow crawl
 * budget for no SEO benefit. A single file stays well under Google's
 * 50,000 URL / 50 MB limit without them.
 */

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: ChangeFrequency }> = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/tournaments", priority: 0.8, changeFrequency: "weekly" },
  { path: "/news", priority: 0.6, changeFrequency: "daily" },
  { path: "/about", priority: 0.5, changeFrequency: "daily" },
  { path: "/transparency", priority: 0.5, changeFrequency: "daily" },
  { path: "/finance", priority: 0.5, changeFrequency: "daily" },
  { path: "/developers-doc", priority: 0.2, changeFrequency: "yearly" },
  { path: "/data", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal", priority: 0.2, changeFrequency: "yearly" },
  { path: "/takedown", priority: 0.2, changeFrequency: "yearly" },
  { path: "/help/add_tournament", priority: 0.2, changeFrequency: "yearly" },
  { path: "/help/edit_page", priority: 0.2, changeFrequency: "yearly" },
];

const TOURNAMENT_TABS = ["", "/matches", "/stats"];

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const localize = (path: string) => localizedEntry(base, path);

  const [tournamentRows, teamRows, newsRows] = await Promise.all([
    db
      .select({ id: tournaments.id, name: tournaments.name })
      .from(tournaments)
      .where(and(eq(tournaments.active, true), visibleTournament))
      .orderBy(tournaments.id),
    db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(and(eq(teams.isActive, true), visibleTeam))
      .orderBy(teams.id),
    db.select({ slug: news.slug, publishedAt: news.publishedAt }).from(news).where(isNewsPublishedCondition()).orderBy(news.slug),
  ]);

  return [
    ...STATIC_PATHS.map(({ path, priority, changeFrequency }) => ({ ...localize(path), priority, changeFrequency })),
    ...tournamentRows.flatMap((t) =>
      TOURNAMENT_TABS.map((tab) => ({ ...localize(`/tournaments/${t.id}/${slugify(t.name)}${tab}`), priority: 0.9, changeFrequency: "weekly" as const })),
    ),
    ...teamRows.map((t) => ({ ...localize(`/team/${t.id}/${slugify(t.name)}`), priority: 0.6, changeFrequency: "weekly" as const })),
    ...newsRows.map((n) => ({ ...localize(`/news/${n.slug}`), priority: 0.7, changeFrequency: "monthly" as const, lastModified: n.publishedAt ?? undefined })),
  ];
}

/** One sitemap entry per path, `url` on the default locale plus `alternates.languages` for every other locale (localePrefix is "always", see i18n/routing.ts). */
function localizedEntry(base: string, path: string): { url: string; alternates: { languages: Record<string, string> } } {
  const languages = Object.fromEntries(routing.locales.map((locale) => [locale, `${base}/${locale}${path}`]));
  return { url: `${base}/${routing.defaultLocale}${path}`, alternates: { languages } };
}
