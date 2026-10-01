/**
 * GC-Stats - search
 *
 * Adapts the shared global search helper (`@/lib/search`) to the API v2
 * snake_case response shape, grouped by entity type.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, inArray, isNotNull } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { people } from "@gc-stats/db";
import { searchGlobal, type SearchResultItem } from "@/lib/search";

export type ApiSearchResultItem = {
  type: string;
  id: number;
  title: string;
  subtitle: string | null;
  country_code: string | null;
  secondary_country_code: string | null;
  logo_url: string | null;
  logo_url_light: string | null;
  path: string;
  score: number;
  popularity: number;
};

export type ApiPlayerSearchResultItem = ApiSearchResultItem & { is_claimed: boolean };

export type ApiSearchResults = {
  team: ApiSearchResultItem[];
  player: ApiPlayerSearchResultItem[];
  tournament: ApiSearchResultItem[];
  organization: ApiSearchResultItem[];
};

function toApiSearchItem(item: SearchResultItem): ApiSearchResultItem {
  return {
    type: item.type,
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    country_code: item.countryCode,
    secondary_country_code: item.secondaryCountryCode,
    logo_url: item.logoUrl,
    logo_url_light: item.logoUrlLight,
    path: item.path,
    score: item.score,
    popularity: item.popularity,
  };
}

/** Thin snake_case wrapper over `searchGlobal` (`lib/search.ts`), the same multi-type fuzzy search behind the site's header dropdown and `/search` page. */
export async function searchV2(term: string, perTypeLimit: number): Promise<ApiSearchResults> {
  const results = await searchGlobal(term, { perTypeLimit });
  const playerIds = results.player.map((p) => p.id);
  const claimed = playerIds.length
    ? new Set((await db.select({ id: people.id }).from(people).where(and(inArray(people.id, playerIds), isNotNull(people.userId)))).map((r) => r.id))
    : new Set<number>();

  return {
    team: results.team.map(toApiSearchItem),
    player: results.player.map((p) => ({ ...toApiSearchItem(p), is_claimed: claimed.has(p.id) })),
    tournament: results.tournament.map(toApiSearchItem),
    organization: results.organization.map(toApiSearchItem),
  };
}
