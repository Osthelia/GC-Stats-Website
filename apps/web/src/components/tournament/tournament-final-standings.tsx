/**
 * GC-Stats - tournament-final-standings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { TrophyIcon } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GOLD } from "@/lib/home-fake-data";
import { TeamBadge } from "@/components/home/team-badge";
import type { PublicFinalStandingRow } from "@/lib/tournament-bracket-data";

const PODIUM_ACCENT: Record<number, { badge: string; row: string }> = {
  1: { badge: "bg-yellow-400/15 text-yellow-300", row: "from-yellow-400/[0.08] border-yellow-400/25" },
  2: { badge: "bg-slate-300/15 text-slate-200", row: "from-slate-300/[0.08] border-slate-300/25" },
  3: { badge: "bg-orange-600/20 text-orange-400", row: "from-orange-600/[0.08] border-orange-600/25" },
};

/**
 * A stage's resolved final placements (place / points / cash prize),
 * sourced from `stage_qualifications` rules the bracket editor determined —
 * design ported from V1's `leaderboard.blade.php` (podium-accented top 3,
 * plain list for the rest), minus the "—" placeholder CLAUDE.md forbids.
 */
export async function TournamentFinalStandings({ rows }: { rows: PublicFinalStandingRow[] }) {
  if (rows.length === 0) return null;

  const t = await getTranslations("tournamentPage");
  const locale = await getLocale();
  const top3 = rows.filter((r) => r.placement <= 3);
  const rest = rows.filter((r) => r.placement > 3);
  const hasMoney = rows.some((r) => r.cashPrizeAmount !== null);
  const numberFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const moneyFmt = (row: PublicFinalStandingRow) =>
    row.cashPrizeAmount !== null && row.cashPrizeCurrency ? `${numberFmt.format(Number(row.cashPrizeAmount))} ${row.cashPrizeCurrency}` : null;

  function Row({ row, podium }: { row: PublicFinalStandingRow; podium: boolean }) {
    const accent = PODIUM_ACCENT[row.placement] ?? PODIUM_ACCENT[3]!;
    const money = moneyFmt(row);
    return (
      <div
        className={
          podium
            ? `flex items-center gap-3 rounded-full border bg-gradient-to-r ${accent.row} to-transparent py-1.5 pr-3 pl-1.5 md:gap-4 md:pr-5`
            : "flex items-center gap-3 px-3 py-2 transition-colors hover:bg-white/[0.02] md:gap-4 md:px-5"
        }
      >
        <span
          className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-black md:h-8 md:w-8 ${podium ? accent.badge : "bg-white/5 text-neutral-400"}`}
        >
          {row.placement}
        </span>

        <div className="min-w-0 flex-1">
          {row.teamHref ? (
            <Link href={row.teamHref} className="group flex items-center gap-2">
              <TeamBadge tag={row.shortName ?? row.displayName} logoUrl={row.logoUrl} logoUrlLight={row.logoUrlLight} size={20} />
              <span className={`truncate text-[11px] font-bold uppercase transition-colors group-hover:text-[#e4ae22] md:text-xs ${podium ? "text-neutral-100" : "text-neutral-300"}`}>
                {row.displayName}
              </span>
            </Link>
          ) : (
            <span className={`truncate text-[11px] font-bold uppercase md:text-xs ${podium ? "text-neutral-100" : "text-neutral-300"}`}>{row.displayName}</span>
          )}
          <span className="block text-[10px] font-medium text-neutral-500">{row.placementLabel}</span>
        </div>

        <div className="flex flex-none items-center gap-3 md:gap-6">
          {row.points !== null && (
            <div className="w-9 shrink-0 text-center">
              <div className={`truncate text-[11px] font-black md:text-xs ${podium ? "text-neutral-100" : "text-neutral-300"}`}>{row.points}</div>
              <div className="text-[7px] font-bold tracking-widest text-neutral-600 uppercase md:text-[8px]">{t("finalStandingsPoints")}</div>
            </div>
          )}
          {hasMoney && (
            <div className="w-16 shrink-0 text-center">
              <div className={`truncate text-[11px] font-black md:text-xs ${podium ? "text-neutral-100" : "text-neutral-300"}`}>{money ?? ""}</div>
              <div className="text-[7px] font-bold tracking-widest text-neutral-600 uppercase md:text-[8px]">{t("finalStandingsCashPrize")}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-1 flex items-center gap-2">
        <TrophyIcon className="h-3 w-3 shrink-0" style={{ color: GOLD }} />
        <span className="shrink-0 text-[9px] font-black tracking-[0.25em] text-neutral-400 uppercase">{t("finalStandingsTitle")}</span>
        <div className="h-px grow" style={{ background: `linear-gradient(90deg, ${GOLD}80 0%, ${GOLD}0d 60%, transparent 100%)` }} />
      </div>

      <div className={`space-y-1.5 ${rest.length > 0 ? "mb-1.5" : ""}`}>
        {top3.map((row) => (
          <Row key={row.qualificationId + ":" + row.entrantId} row={row} podium />
        ))}
      </div>

      {rest.length > 0 && (
        <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
          {rest.map((row) => (
            <Row key={row.qualificationId + ":" + row.entrantId} row={row} podium={false} />
          ))}
        </div>
      )}
    </div>
  );
}
