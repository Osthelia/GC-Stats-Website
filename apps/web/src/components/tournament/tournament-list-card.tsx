/**
 * GC-Stats - tournament-list-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";
import { TournamentBadge } from "@/components/tournament/tournament-badge";

export type TournamentListCardItem = {
  id: number;
  slug: string;
  name: string;
  region: string;
  regionColor: string;
  dates: string;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

/** Compact tournament row (logo, name, region, dates) shared by the home and organization pages. */
export function TournamentListCard({ tournament }: { tournament: TournamentListCardItem }) {
  return (
    <Link
      href={`/tournaments/${tournament.id}/${tournament.slug}`}
      className="gcs-accent-card flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] py-2.5 pl-3 pr-3 transition-all hover:translate-x-1 hover:bg-[var(--gcs-hover)] active:scale-[0.98]"
      style={{ borderLeft: `3px solid ${tournament.regionColor}` }}
    >
      <TournamentBadge name={tournament.name} logoUrl={tournament.logoUrl} logoUrlLight={tournament.logoUrlLight} size={30} bare />
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold tracking-tight text-neutral-50">{tournament.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="whitespace-nowrap text-[12.5px] font-medium" style={{ color: tournament.regionColor }}>{tournament.region}</span>
          <span className="h-[3px] w-[3px] flex-none rounded-full bg-neutral-700" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-neutral-500">{tournament.dates}</span>
        </div>
      </div>
    </Link>
  );
}
