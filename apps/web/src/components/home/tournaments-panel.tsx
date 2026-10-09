/**
 * GC-Stats - tournaments-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TournamentListCard } from "@/components/tournament/tournament-list-card";
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
                <TournamentListCard key={tour.id} tournament={tour} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
