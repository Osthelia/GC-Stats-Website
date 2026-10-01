/**
 * GC-Stats - recent-matches-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { HomeMatch } from "@/lib/home-data";
import { MatchCard } from "@/components/matches/match-card";

/**
 * "Recent matches" overview card — shared by any entity's overview tab
 * (team, player, ...). Just the card header (title + "see all" link) plus
 * the match list; the entity-specific data/labels come in as props.
 */
export async function RecentMatchesPanel({
  matches,
  title,
  seeAllHref,
  seeAllLabel,
  emptyLabel,
  highlightWinner = true,
}: {
  matches: HomeMatch[];
  title: string;
  seeAllHref: string;
  seeAllLabel: string;
  emptyLabel: string;
  /** See `MatchCard` — pass `false` on a page with no "home side" (e.g. a tournament). */
  highlightWinner?: boolean;
}) {
  const home = await getTranslations("home");

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2 className="text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{title}</h2>
        <span className="flex-1" />
        <Link href={seeAllHref} className="font-mono text-[11px] text-[#e4ae22] hover:underline">
          {seeAllLabel}
        </Link>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <div className="@container flex flex-col gap-2.5">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} vsLabel={home("vs")} highlightWinner={highlightWinner} />
          ))}
        </div>
      )}
    </div>
  );
}
