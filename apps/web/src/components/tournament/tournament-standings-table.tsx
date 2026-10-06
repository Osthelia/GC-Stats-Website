/**
 * GC-Stats - tournament-standings-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TeamBadge } from "@/components/home/team-badge";
import type { PublicStandingsRow, PublicQualificationRule } from "@/lib/tournament-bracket-data";

const QUALIFIED = "#3fb950";
const ELIMINATED = "#f2555a";

/**
 * Single table, no second bordered card around it (explicit user request,
 * 2026-09-12: "un seul tableau, pas un tableau dans un container inutile")
 * — this always renders inside `TournamentContainerTabs`'/`BracketViewerStandingsTabs`'
 * own bordered card, which already carries the status/date header, so a
 * second full border here was pure duplication. Columns/coloring/qualification
 * indicator lifted directly from V1 (`swiss-standings.blade.php`,
 * `round-robin.blade.php`, `qualification-legend.blade.php`): one combined
 * Matches (W-L) and Maps (W-L) column each, a colored round differential
 * with the raw round W/L underneath, a green/red left border per row when
 * the container has advancement rules (rank qualifies vs. doesn't), and a
 * legend sentence per rule below the table.
 */
export async function TournamentStandingsTable({
  standings,
  showPoints,
  qualificationRules = [],
}: {
  standings: PublicStandingsRow[];
  showPoints?: boolean;
  qualificationRules?: PublicQualificationRule[];
}) {
  const t = await getTranslations("tournamentPage");
  const columnCount = showPoints ? 6 : 5;
  const hasQualificationRules = qualificationRules.length > 0;

  return (
    <div className="overflow-hidden rounded-lg" style={{ background: "var(--gcs-surface-3)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-[11px] font-semibold tracking-[0.06em] text-neutral-500 uppercase">
            <th className="px-4 py-2.5 text-center">{t("standingsRank")}</th>
            <th className="px-4 py-2.5">{t("standingsEntrant")}</th>
            <th className="px-4 py-2.5 text-center">{t("standingsMatches")}</th>
            <th className="px-4 py-2.5 text-center">{t("standingsMaps")}</th>
            {showPoints && <th className="px-4 py-2.5 text-right">{t("standingsPoints")}</th>}
            <th className="px-4 py-2.5 text-right">{t("standingsRounds")}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const rule = qualificationRules.find((r) => row.rank >= r.rankFrom && row.rank <= r.rankTo);
            const borderColor = !hasQualificationRules ? "transparent" : rule ? QUALIFIED : ELIMINATED;
            const roundColor = row.roundDiff > 0 ? "#3fb950" : row.roundDiff < 0 ? "#f2555a" : "var(--gcs-text-tertiary)";
            return (
              <tr
                key={row.id}
                className="border-b border-neutral-800/60 transition-colors last:border-0 odd:bg-white/[0.015] hover:bg-white/[0.04]"
                style={{ borderLeft: `2px solid ${borderColor}` }}
              >
                <td className="px-4 py-2.5 text-center font-mono text-xs text-neutral-500">{row.rank}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--gcs-text)" }}>
                  {row.teamHref ? (
                    <Link href={row.teamHref} className="flex items-center gap-2 transition-colors hover:text-[#e4ae22]">
                      <TeamBadge tag={row.displayName} logoUrl={row.logoUrl} logoUrlLight={row.logoUrlLight} size={22} />
                      {row.displayName}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2">
                      <TeamBadge tag={row.displayName} logoUrl={row.logoUrl} logoUrlLight={row.logoUrlLight} size={22} />
                      {row.displayName}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center font-mono tabular-nums text-neutral-300">
                  {row.wins} <span className="text-neutral-600">-</span> {row.losses}
                </td>
                <td className="px-4 py-2.5 text-center font-mono tabular-nums text-neutral-300">
                  {row.mapWins} <span className="text-neutral-600">-</span> {row.mapLosses}
                </td>
                {showPoints && <td className="px-4 py-2.5 text-right font-mono tabular-nums text-neutral-300">{row.points ?? 0}</td>}
                <td className="px-4 py-2.5 text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-xs tabular-nums" style={{ color: roundColor }}>
                      {row.roundDiff > 0 ? `+${row.roundDiff}` : row.roundDiff}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-600">
                      {row.roundWins}W / {row.roundLosses}L
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
          {standings.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="px-4 py-8 text-center text-sm text-neutral-500">
                {t("standingsEmpty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {hasQualificationRules && (
        <div className="flex flex-col gap-1.5 border-t border-neutral-800 bg-white/[0.02] px-4 py-2.5">
          {qualificationRules.map((rule) => {
            const dest = (chunks: React.ReactNode) => (
              <Link href={rule.url} className="font-semibold text-neutral-200 underline decoration-neutral-600 underline-offset-2 hover:text-[#e4ae22]">
                {chunks}
              </Link>
            );
            return (
              <p key={`${rule.rankFrom}-${rule.rankTo}`} className="text-[11px] font-medium text-neutral-400">
                {rule.rankFrom === rule.rankTo
                  ? t.rich("qualificationSingle", { rank: rule.rankFrom, destination: rule.label, dest })
                  : t.rich("qualificationRange", { from: rule.rankFrom, to: rule.rankTo, destination: rule.label, dest })}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
