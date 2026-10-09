/**
 * GC-Stats - liquipedia-match-import-dialog
 *
 * Modal of the Liquipedia Match Import page: paste a match's wikicode, the
 * import rebuilds its veto and maps, then fetches the Riot data. Team name
 * conflicts always keep what is in the database.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
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
import type { BracketViewerMatchTarget } from "@/components/admin/bracket-viewer/bracket-viewer-match-action";

export function LiquipediaMatchImportDialog({ tournamentId, match, onClose }: { tournamentId: number; match: BracketViewerMatchTarget | null; onClose: () => void }) {
  return (
    <Dialog open={match !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">{match && <ImportForm key={match.id} tournamentId={tournamentId} match={match} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function ImportForm({ tournamentId, match, onClose }: { tournamentId: number; match: BracketViewerMatchTarget; onClose: () => void }) {
  const t = useTranslations("admin.tournaments.matches.wikicode");
  const tPage = useTranslations("admin.tournaments.liquipediaImportPage");
  const tMatches = useTranslations("admin.tournaments.matches");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wikicode, setWikicode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fetches, setFetches] = useState<ImportMapFetch[] | null>(null);

  function handleImport() {
    if (wikicode.trim() === "") {
      setError(t("error.required"));
      return;
    }
    setError(null);
    startTransition(async () => {
      // A Liquipedia name conflict is never asked here, the database entry wins.
      const result = await importMatchWikicode(match.id, wikicode, { "1": "keep", "2": "keep" });
      if (!result.ok) {
        setError(result.error === "liquipediaConflict" ? t("error.invalidResolution") : t(`error.${result.error}`));
        return;
      }
      setFetches(result.fetches);
      router.refresh();
    });
  }

  const title = `${match.teamA ?? tMatches("tbdLabel")} vs ${match.teamB ?? tMatches("tbdLabel")}`;

  if (fetches) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{tPage("doneDescription")}</DialogDescription>
        </DialogHeader>
        <LiquipediaImportFetchResults tournamentId={tournamentId} matchId={match.id} fetches={fetches} />
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
        <DialogDescription>{tPage("dialogDescription")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="liquipedia-match-wikicode">
          {tPage("wikicodeLabel")}
          <RequiredMark />
        </Label>
        <Textarea
          id="liquipedia-match-wikicode"
          rows={10}
          placeholder={t("placeholder")}
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
            {tPage("importingHint")}
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
