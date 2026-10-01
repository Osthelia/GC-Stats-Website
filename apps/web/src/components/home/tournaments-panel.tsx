/**
 * GC-Stats - tournaments-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TournamentBadge } from "@/components/tournament/tournament-badge";
import type { HomeTournament } from "@/lib/home-data";

export function TournamentsPanel({ groups }: { groups: { label: "ongoing" | "upcomingGroup"; items: HomeTournament[] }[] }) {
  const t = useTranslations("home");

  return (
    <div>
      <div className="mb-3.5 flex items-baseline gap-3">
        <h2 className="text-[17px] font-bold tracking-tight text-neutral-50">{t("tournamentsHeading")}</h2>
        <Link href="/tournaments" className="ml-auto text-[13.5px] font-medium text-neutral-500 hover:text-[#e4ae22]">
          {t("all")}
        </Link>
      </div>

      <div className="flex flex-col gap-[22px]">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: group.label === "ongoing" ? "var(--gcs-text)" : "var(--gcs-text-secondary)" }}>
                {t(group.label === "ongoing" ? "ongoing" : "upcomingGroup")}
              </span>
              <span className="text-[13px] tabular-nums text-neutral-600">{group.items.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {group.items.map((tour) => (
                <Link
                  key={tour.id}
                  href={`/tournaments/${tour.id}/${tour.slug}`}
                  className="gcs-accent-card flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] py-2.5 pl-3 pr-3 transition-all hover:translate-x-1 hover:bg-[var(--gcs-hover)]"
                  style={{ borderLeft: `3px solid ${tour.regionColor}` }}
                >
                  <TournamentBadge name={tour.name} logoUrl={tour.logoUrl} logoUrlLight={tour.logoUrlLight} size={30} bare />
                  <div className="min-w-0 flex-1">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold tracking-tight text-neutral-50">
                      {tour.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="whitespace-nowrap text-[12.5px] font-medium" style={{ color: tour.regionColor }}>{tour.region}</span>
                      <span className="h-[3px] w-[3px] flex-none rounded-full bg-neutral-700" />
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-neutral-500">{tour.dates}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
