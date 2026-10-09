/**
 * GC-Stats - liquipedia-import-fetch-results
 *
 * Per map outcome of the Riot fetch run by a Liquipedia import. A map that
 * needs an admin step links to its page and keeps its data.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ImportMapFetch } from "@/actions/admin-matches";

type ReasonKey = "missingPuuids" | "teamColorAmbiguous" | "relay" | "other";

function reasonKey(reason: Extract<ImportMapFetch, { status: "needsStep" }>["reason"]): ReasonKey {
  switch (reason) {
    case "missingPuuids":
    case "teamColorAmbiguous":
      return reason;
    case "relay":
    case "invalidResponse":
      return "relay";
    default:
      return "other";
  }
}

export function LiquipediaImportFetchResults({ tournamentId, matchId, fetches }: { tournamentId: number; matchId: number; fetches: ImportMapFetch[] }) {
  const t = useTranslations("admin.tournaments.matches.wikicode.fetch");

  if (fetches.length === 0) return <p className="text-sm text-muted-foreground">{t("none")}</p>;

  return (
    <ul className="flex flex-col gap-2">
      {fetches.map((fetch) => (
        <li
          key={fetch.mapId}
          className={
            fetch.status === "fetched"
              ? "flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-sm"
              : "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-sm"
          }
        >
          {fetch.status === "fetched" ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />}
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{t("mapLabel", { order: fetch.order, map: fetch.mapName })}</span>
            {fetch.status === "fetched" ? (
              <span className="text-xs text-muted-foreground">{t("fetched")}</span>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">{t(`reason.${reasonKey(fetch.reason)}`)}</span>
                <Link
                  href={`/admin/tournaments/${tournamentId}/matches/${matchId}/maps/${fetch.mapId}`}
                  className="w-fit text-xs text-primary transition-opacity hover:underline active:opacity-60"
                >
                  {t("openMap")}
                </Link>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
