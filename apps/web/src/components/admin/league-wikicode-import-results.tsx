/**
 * GC-Stats - league-wikicode-import-results
 *
 * What a League match wikicode import did, game by game: what it created or
 * filled, what it kept because something with a higher priority was there,
 * and what the admin should look at.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";
import type { ImportLeagueWikicodeResult, LeagueWikicodeGameResult } from "@/actions/admin-lol-games";

export type LeagueWikicodeImportDone = Extract<ImportLeagueWikicodeResult, { ok: true }>;
type LeagueWikicodeImportFailed = Exclude<Extract<ImportLeagueWikicodeResult, { ok: false }>, { error: "liquipediaConflict" }>;

/** The message for a failed import. A Liquipedia name conflict is not one: the caller asks the admin to choose. */
export function useLeagueImportErrorText(): (failure: LeagueWikicodeImportFailed) => string {
  const t = useTranslations("admin.tournaments.matches.wikicode.league.error");
  const tShared = useTranslations("admin.tournaments.matches.wikicode.error");
  return (failure) => {
    switch (failure.error) {
      case "required":
      case "tooLong":
      case "invalidResolution":
        return tShared(failure.error);
      case "unknownChampions":
        return t("unknownChampions", { names: failure.names.join(", ") });
      case "duplicateChampion":
        return t("duplicateChampion", { order: failure.order, champion: failure.championName });
      default:
        return t(failure.error);
    }
  };
}

function GameResult({ game }: { game: LeagueWikicodeGameResult }) {
  const t = useTranslations("admin.tournaments.matches.wikicode.league.results");
  const fields = (list: LeagueWikicodeGameResult["filled"]) => list.map((field) => t(`field.${field}`)).join(", ");
  const draft = game.draft;
  const draftText = draft.status === "written" ? t("draft.written") : draft.status === "kept" ? t(`draft.kept.${draft.reason}`) : t(`draft.none.${draft.reason}`);
  const warns = game.differs.length > 0 || draft.status === "kept" || (draft.status === "none" && draft.reason === "noSide");

  return (
    <li
      className={
        warns
          ? "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-sm"
          : "flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-sm"
      }
    >
      {warns ? <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-500" /> : <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500" />}
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{t("gameLabel", { order: game.order })}</span>
        {game.created && <span className="text-xs text-muted-foreground">{t("created")}</span>}
        {!game.created && game.filled.length > 0 && <span className="text-xs text-muted-foreground">{t("filled", { fields: fields(game.filled) })}</span>}
        {game.differs.length > 0 && <span className="text-xs text-muted-foreground">{t("differs", { fields: fields(game.differs) })}</span>}
        <span className="text-xs text-muted-foreground">{draftText}</span>
      </div>
    </li>
  );
}

export function LeagueWikicodeImportResults({ result }: { result: LeagueWikicodeImportDone }) {
  const t = useTranslations("admin.tournaments.matches.wikicode.league.results");

  if (result.forfeit) return <p className="text-sm text-muted-foreground">{t("forfeit")}</p>;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {result.games.map((game) => (
          <GameResult key={game.order} game={game} />
        ))}
      </ul>
      {result.patchSet && <p className="text-xs text-muted-foreground">{t("patchSet", { patch: result.patchSet })}</p>}
      {result.bestOfDiffers !== null && <p className="text-xs text-muted-foreground">{t("bestOfDiffers", { bestOf: result.bestOfDiffers })}</p>}
      {result.firstPickAssumed && <p className="text-xs text-muted-foreground">{t("firstPickAssumed")}</p>}
    </div>
  );
}
