/**
 * GC-Stats - map-art-banner
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { formatSideScore } from "@/lib/match-score-format";
import { mapSplashUrl } from "@/lib/valorant-maps";

/**
 * Full-width map splash art header for the dedicated map admin page — V1's
 * admin/matches/maps/show.blade.php banner (map art background + dark
 * gradient overlay, team names either side of the map's score, map name as
 * subtitle). Distinct from the plain text `MatchVsBanner` used on
 * show/edit/veto (no map to illustrate there).
 */
export async function MapArtBanner({
  entrantAName,
  entrantBName,
  mapName,
  score,
}: {
  entrantAName: string;
  entrantBName: string;
  mapName: string | null;
  score: { a: number; b: number; entrantAId: number | null; entrantBId: number | null };
}) {
  const t = await getTranslations("admin.tournaments.matches");
  const art = mapSplashUrl(mapName);

  return (
    <div className="relative overflow-hidden rounded-xl border">
      <div className="absolute inset-0 bg-muted" />
      {art && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, next/image adds no value here */}
          <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        </>
      )}
      <div className="relative flex flex-col items-center gap-6 px-6 py-10 text-white md:flex-row md:justify-center">
        <div className="flex-1 text-right">
          <h1 className="truncate text-xl font-bold uppercase leading-none drop-shadow-md">{entrantAName}</h1>
          <div className="mt-1 text-[10px] font-bold tracking-widest text-white/60 uppercase">{t("entrantALabel")}</div>
        </div>

        <div className="flex flex-none flex-col items-center gap-1">
          <div className="flex items-center gap-3 text-3xl font-black drop-shadow-md">
            <span>{formatSideScore(score.a, score.entrantAId)}</span>
            <span className="text-white/50">-</span>
            <span>{formatSideScore(score.b, score.entrantBId)}</span>
          </div>
          <div className="text-xs font-bold tracking-[0.3em] text-white/80 uppercase drop-shadow-md">{mapName ?? t("maps.mapUnknown")}</div>
        </div>

        <div className="flex-1">
          <h1 className="truncate text-xl font-bold uppercase leading-none drop-shadow-md">{entrantBName}</h1>
          <div className="mt-1 text-[10px] font-bold tracking-widest text-white/60 uppercase">{t("entrantBLabel")}</div>
        </div>
      </div>
    </div>
  );
}
