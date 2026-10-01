/**
 * GC-Stats - match-encounters
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GOLD } from "@/lib/home-fake-data";
import type { MatchEncounter, MatchSide } from "@/lib/match-page-data";
import { TeamBadge } from "@/components/home/team-badge";
import { FormattedDate } from "@/components/formatted-date";

export async function MatchEncounters({ a, b, teamAWins, teamBWins, items }: { a: MatchSide; b: MatchSide; teamAWins: number; teamBWins: number; items: MatchEncounter[] }) {
  const t = await getTranslations("matchPage");

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800" style={{ background: "var(--gcs-surface-2)" }}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3.5">
        <span className="text-[10px] font-black tracking-[0.25em] text-neutral-500 uppercase">{t("encounters")}</span>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamBadge tag={a.shortName ?? "?"} logoUrl={a.logoUrl} logoUrlLight={a.logoUrlLight} size={26} />
          <span className="truncate text-[12px] font-bold tracking-tight text-neutral-200 uppercase">{a.shortName ?? a.displayName}</span>
        </div>
        <span className="font-mono text-[13px] font-black text-[var(--gcs-text)]">
          {teamAWins} – {teamBWins}
        </span>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-[12px] font-bold tracking-tight text-neutral-200 uppercase">{b.shortName ?? b.displayName}</span>
          <TeamBadge tag={b.shortName ?? "?"} logoUrl={b.logoUrl} logoUrlLight={b.logoUrlLight} size={26} />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-neutral-600">{t("noEncounters")}</p>
      ) : (
        <div className="flex flex-col gap-1 p-2">
          {items.map((enc) => (
            <Link key={enc.id} href={`/match/${enc.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.03]">
              <span
                className="h-8 w-1 flex-none rounded-full"
                style={{ background: enc.result === "win" ? GOLD : enc.result === "loss" ? "rgba(255,255,255,0.1)" : "#4a4a50" }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{enc.tournamentName}</div>
                <div className="font-mono text-[10px] text-neutral-600">
                  {enc.scheduledAt ? <FormattedDate date={enc.scheduledAt} mode="date" /> : "–"}
                </div>
              </div>
              <div className="flex flex-none items-center gap-1.5 font-mono text-sm font-black tracking-tighter">
                <span style={{ color: enc.result === "win" ? GOLD : "var(--gcs-text)" }}>{enc.scoreA == null ? "–" : enc.scoreA === -1 ? "FF" : enc.scoreA}</span>
                <span className="text-neutral-700">–</span>
                <span style={{ color: enc.result === "loss" ? GOLD : "var(--gcs-text)" }}>{enc.scoreB == null ? "–" : enc.scoreB === -1 ? "FF" : enc.scoreB}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
