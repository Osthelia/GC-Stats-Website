/**
 * GC-Stats - bracket-viewer-final-standings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PublicFinalStandingRow } from "@/lib/tournament-bracket-data";

/** Admin read-only view of a stage's resolved final placements — editing the rules themselves happens on the tournament's bracket editor hub (QualificationRulesPanel), not here. */
export async function BracketViewerFinalStandings({ tournamentId, rows }: { tournamentId: number; rows: PublicFinalStandingRow[] }) {
  if (rows.length === 0) return null;
  const t = await getTranslations("admin.tournaments.finalStandings");

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13.5px] font-bold tracking-tight">{t("heading")}</h2>
        <Link href={`/admin/tournaments/${tournamentId}/bracket-editor`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          {t("manageRulesLink")}
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnPlacement")}</TableHead>
              <TableHead>{t("columnTeam")}</TableHead>
              <TableHead className="text-right">{t("columnPoints")}</TableHead>
              <TableHead className="text-right">{t("columnCashPrize")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.qualificationId + ":" + row.entrantId}>
                <TableCell className="text-sm font-medium">
                  {row.placement} · {row.placementLabel}
                </TableCell>
                <TableCell className="text-sm">{row.displayName}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{row.points ?? t("noValue")}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {row.cashPrizeAmount !== null && row.cashPrizeCurrency ? `${row.cashPrizeAmount} ${row.cashPrizeCurrency}` : t("noValue")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
