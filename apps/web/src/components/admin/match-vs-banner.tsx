/**
 * GC-Stats - match-vs-banner
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { formatSideScore } from "@/lib/match-score-format";

/**
 * V1-style matchup banner (Website/resources/views/admin/matches/{show,veto}.blade.php)
 * — team names either side of a centered "VS", shared across the match
 * show/edit/veto/maps pages. No logos (tournament/team logos aren't
 * migrated to V2 yet).
 *
 * The show/overview page passes `score` and gets the actual score digits
 * centered instead of "VS" (V1 show.blade.php); edit/veto/maps keep "VS".
 */
export async function MatchVsBanner({
  entrantAName,
  entrantBName,
  score,
}: {
  entrantAName: string;
  entrantBName: string;
  score?: { a: number; b: number; entrantAId: number | null; entrantBId: number | null };
}) {
  const t = await getTranslations("admin.tournaments.matches");

  return (
    <div className="flex items-center justify-center gap-6 border-b pb-6">
      <div className="flex-1 text-right">
        <h1 className="truncate text-xl font-bold uppercase leading-none">{entrantAName}</h1>
        <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t("entrantALabel")}</div>
      </div>
      {score ? (
        <div className="flex items-center gap-3 text-3xl font-black">
          <span>{formatSideScore(score.a, score.entrantAId)}</span>
          <span className="text-muted-foreground">-</span>
          <span>{formatSideScore(score.b, score.entrantBId)}</span>
        </div>
      ) : (
        <div className="text-2xl font-black text-muted-foreground italic">{t("vsLabel")}</div>
      )}
      <div className="flex-1">
        <h1 className="truncate text-xl font-bold uppercase leading-none">{entrantBName}</h1>
        <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{t("entrantBLabel")}</div>
      </div>
    </div>
  );
}
