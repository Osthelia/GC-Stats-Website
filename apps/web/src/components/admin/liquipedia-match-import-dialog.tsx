/**
 * GC-Stats - liquipedia-match-import-dialog
 *
 * Modal of the Liquipedia Match Import page: paste a match's wikicode, the
 * import rebuilds its veto and maps, then fetches the Riot data. For League
 * it fills the games and drafts that are still empty. Team name conflicts
 * always keep what is in the database.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RequiredMark } from "@/components/admin/required-mark";
import { LiquipediaImportFetchResults } from "@/components/admin/liquipedia-import-fetch-results";
import { importMatchWikicode, type ImportMapFetch } from "@/actions/admin-matches";
import { importLeagueMatchWikicode } from "@/actions/admin-lol-games";
import { LeagueWikicodeImportResults, useLeagueImportErrorText, type LeagueWikicodeImportDone } from "@/components/admin/league-wikicode-import-results";
import { gameHasSeriesGames } from "@gc-stats/db/game";
import type { BracketViewerMatchTarget } from "@/components/admin/bracket-viewer/bracket-viewer-match-action";
import { useGame } from "@/lib/use-game";

export function LiquipediaMatchImportDialog({ tournamentId, match, onClose }: { tournamentId: number; match: BracketViewerMatchTarget | null; onClose: () => void }) {
  return (
    <Dialog open={match !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">{match && <ImportForm key={match.id} tournamentId={tournamentId} match={match} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function ImportForm({ tournamentId, match, onClose }: { tournamentId: number; match: BracketViewerMatchTarget; onClose: () => void }) {
  const game = useGame();
  const t = useTranslations("admin.tournaments.matches.wikicode");
  const tLeague = useTranslations("admin.tournaments.matches.wikicode.league");
  const tPage = useTranslations("admin.tournaments.liquipediaImportPage");
  const isLeague = gameHasSeriesGames(game);
  const tPageLeague = useTranslations("admin.tournaments.liquipediaImportPage.league");
  // The League texts have the same keys as the Valorant ones.
  const pageCopy = isLeague ? tPageLeague : tPage;
  const leagueErrorText = useLeagueImportErrorText();
  const tMatches = useTranslations("admin.tournaments.matches");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wikicode, setWikicode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fetches, setFetches] = useState<ImportMapFetch[] | null>(null);
  const [leagueResult, setLeagueResult] = useState<LeagueWikicodeImportDone | null>(null);

  function handleImport() {
    if (wikicode.trim() === "") {
      setError(t("error.required"));
      return;
    }
    setError(null);
    startTransition(async () => {
      // A Liquipedia name conflict is never asked here, the database entry wins.
      const keep = { "1": "keep", "2": "keep" } as const;
      const result = isLeague ? await importLeagueMatchWikicode(game, match.id, wikicode, keep) : await importMatchWikicode(game, match.id, wikicode, keep);
      if (!result.ok) {
        if (result.error === "liquipediaConflict") setError(t("error.invalidResolution"));
        else setError(isLeague ? leagueErrorText(result as Parameters<typeof leagueErrorText>[0]) : t(`error.${result.error}` as "error.required"));
        return;
      }
      if ("fetches" in result) setFetches(result.fetches);
      else setLeagueResult(result);
      router.refresh();
    });
  }

  const title = `${match.teamA ?? tMatches("tbdLabel")} vs ${match.teamB ?? tMatches("tbdLabel")}`;

  if (fetches || leagueResult) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{tPage("doneDescription")}</DialogDescription>
        </DialogHeader>
        {fetches && <LiquipediaImportFetchResults tournamentId={tournamentId} matchId={match.id} fetches={fetches} />}
        {leagueResult && <LeagueWikicodeImportResults result={leagueResult} />}
        <DialogFooter>
          <Button onClick={onClose}>{tPage("close")}</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{pageCopy("dialogDescription")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="liquipedia-match-wikicode">
          {tPage("wikicodeLabel")}
          <RequiredMark />
        </Label>
        <Textarea
          id="liquipedia-match-wikicode"
          rows={10}
          placeholder={(isLeague ? tLeague : t)("placeholder")}
          value={wikicode}
          onChange={(e) => setWikicode(e.target.value)}
          className="font-mono text-xs"
          aria-invalid={!!error}
          disabled={isPending}
        />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        {isPending && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            {pageCopy("importingHint")}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          {tPage("close")}
        </Button>
        <Button onClick={handleImport} disabled={isPending}>
          {isPending ? t("importing") : t("importButton")}
        </Button>
      </DialogFooter>
    </>
  );
}
