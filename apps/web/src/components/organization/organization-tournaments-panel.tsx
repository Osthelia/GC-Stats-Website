/**
 * GC-Stats - organization-tournaments-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { TournamentListCard, type TournamentListCardItem } from "@/components/tournament/tournament-list-card";

/** "Organized tournaments" section of the organization home, rendered only when the organization has some. */
export async function OrganizationTournamentsPanel({ tournaments }: { tournaments: TournamentListCardItem[] }) {
  if (tournaments.length === 0) return null;
  const t = await getTranslations("organizationPage");

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("organizedTournaments")}</h2>
        <span className="text-[13px] tabular-nums text-neutral-600">{tournaments.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentListCard key={tournament.id} tournament={tournament} />
        ))}
      </div>
    </div>
  );
}
