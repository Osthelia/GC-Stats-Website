/**
 * GC-Stats - league-game-find
 *
 * "Find games" of the game dialog: looks for the games of a League series that were played with tournament codes.
 * It shows what the search starts from (region, time window, the Riot accounts known per team, any Riot ID typed
 * here), lists the games it finds with which team is on which side, and hands the picked one to the dialog, which
 * opens it in the preview like any Riot match id; saving there closes the dialog. Nothing is stored here.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { FormattedDate } from "@/components/formatted-date";
import { findGamesForMatch, getFindGamesBasisForMatch, type FindGamesBasis, type FindGamesError, type FindGamesResult, type FoundGame } from "@/actions/admin-leaguepedia";
import { LolSideBadge } from "@/components/admin/lol-side-badge";
import { RIOT_CLUSTERS, type RiotCluster } from "@gc-stats/lol-stats-engine";

// Proper names of Riot's regions, so they are not translated.
const CLUSTER_NAMES: Record<RiotCluster, string> = { americas: "Americas", europe: "Europe", asia: "Asia", sea: "SEA" };

/** What the admin set for a search. Kept by the dialog, so coming back from the preview shows the same search. */
export interface FindCriteria {
  cluster: RiotCluster | null;
  start: string | null;
  end: string | null;
  riotIds: string[];
}

export interface FindSaved {
  criteria: FindCriteria;
  result: FindGamesResult | null;
}

export function LeagueGameFind({
  tournamentId,
  matchId,
  saved,
  busy,
  onSearched,
  onPick,
  onBack,
}: {
  tournamentId: number;
  matchId: number;
  /** The last search of this dialog, when there was one. */
  saved: FindSaved | null;
  /** The dialog is loading a picked game. */
  busy: boolean;
  onSearched: (saved: FindSaved) => void;
  onPick: (game: FoundGame) => void;
  onBack: () => void;
}) {
  const t = useTranslations("admin.tournaments.matches.games");
  const [isSearching, startSearching] = useTransition();
  const [basis, setBasis] = useState<FindGamesBasis | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [criteria, setCriteria] = useState<FindCriteria>(saved?.criteria ?? { cluster: null, start: null, end: null, riotIds: [""] });
  const [result, setResult] = useState<FindGamesResult | null>(saved?.result ?? null);
  const defaultsApplied = useRef(saved !== null);

  // The basis is read again when the region changes, for the account counts of that region.
  useEffect(() => {
    let cancelled = false;
    getFindGamesBasisForMatch(tournamentId, matchId, criteria.cluster)
      .then((next) => {
        if (cancelled) return;
        if (next === null) {
          setLoadFailed(true);
          return;
        }
        setBasis(next);
        if (!defaultsApplied.current) {
          // First time: the region and the window come from the series.
          defaultsApplied.current = true;
          setCriteria((prev) => ({ ...prev, cluster: next.region.kind === "cluster" ? next.region.cluster : prev.cluster, start: next.window?.start ?? null, end: next.window?.end ?? null }));
        }
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [tournamentId, matchId, criteria.cluster]);

  const typedRiotIds = criteria.riotIds.filter((id) => id.trim() !== "");
  const regionUnsupported = basis?.region.kind === "unsupported";
  const knownAccounts = basis?.teams.reduce((sum, team) => sum + (team.withAccount ?? 0), 0) ?? 0;
  // No team has an account on this region, so the search can only start from a typed Riot ID.
  const riotIdRequired = basis !== null && criteria.cluster !== null && knownAccounts === 0;
  const needsRiotId = riotIdRequired && typedRiotIds.length === 0;
  const canSearch = basis !== null && !regionUnsupported && criteria.cluster !== null && criteria.start !== null && criteria.end !== null && !needsRiotId && !isSearching && !busy;

  function search(use: FindCriteria) {
    if (use.cluster === null || use.start === null || use.end === null) return;
    const { cluster, start, end } = use;
    startSearching(async () => {
      const next = await findGamesForMatch(tournamentId, matchId, { cluster, start, end, riotIds: use.riotIds.filter((id) => id.trim() !== "") });
      setResult(next);
      onSearched({ criteria: use, result: next });
    });
  }

  const set = (patch: Partial<FindCriteria>) => setCriteria((prev) => ({ ...prev, ...patch }));
  const setRiotId = (index: number, value: string) => set({ riotIds: criteria.riotIds.map((id, i) => (i === index ? value : id)) });
  const teamName = (entrantId: number | null) => basis?.teams.find((team) => team.entrantId === entrantId)?.name ?? t("find.sideUnknown");

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-500">
        <TriangleAlertIcon className="mt-0.5 size-3.5 flex-none" />
        <p>{t("find.relayWarning")}</p>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        {basis?.teams.map((team) => (
          <div key={team.entrantId} className="text-muted-foreground">
            {team.withAccount === null ? team.name : t("find.teamAccounts", { name: team.name, count: team.withAccount, total: team.players })}
          </div>
        ))}
        {loadFailed && <p className="text-destructive">{t("find.error.generic")}</p>}
      </div>

      {basis && (
        <div className="flex flex-col gap-3">
          {basis.region.kind === "cluster" && <p className="text-xs text-muted-foreground">{t("find.regionInferred", { cluster: CLUSTER_NAMES[basis.region.cluster] })}</p>}
          {basis.region.kind === "unsupported" && <p className="text-sm text-destructive">{t("find.regionUnsupported")}</p>}
          {basis.region.kind === "ask" && (
            <FormField label={t("find.regionLabel")} htmlFor="find-cluster" hint={t("find.regionAsk")}>
              <Select items={CLUSTER_NAMES} value={criteria.cluster ?? ""} onValueChange={(value) => set({ cluster: value as RiotCluster })}>
                <SelectTrigger id="find-cluster" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RIOT_CLUSTERS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {CLUSTER_NAMES[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {!regionUnsupported && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField label={t("find.windowStart")} htmlFor="find-start" required>
                  <DateTimeInput id="find-start" value={criteria.start} onChange={(start) => set({ start })} />
                </FormField>
                <FormField label={t("find.windowEnd")} htmlFor="find-end" required>
                  <DateTimeInput id="find-end" value={criteria.end} onChange={(end) => set({ end })} />
                </FormField>
              </div>
              <p className="text-xs text-muted-foreground">{basis.scheduledAt ? t("find.windowHint") : t("find.noSchedule")}</p>

              <div className="flex flex-col gap-2">
                <FormField label={t("find.riotIdLabel")} htmlFor="find-riot-id-0" hint={t("find.riotIdHint")} required={riotIdRequired}>
                  <div className="flex flex-col gap-2">
                    {criteria.riotIds.map((riotId, index) => (
                      <Input key={index} id={`find-riot-id-${index}`} className="font-mono text-xs" value={riotId} placeholder={t("find.riotIdPlaceholder")} onChange={(e) => setRiotId(index, e.target.value)} />
                    ))}
                  </div>
                </FormField>
                <div>
                  <Button variant="outline" size="sm" onClick={() => set({ riotIds: [...criteria.riotIds, ""] })}>
                    {t("find.addRiotId")}
                  </Button>
                </div>
                {needsRiotId && <p className="text-xs text-amber-500">{t("find.riotIdRequired")}</p>}
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <Button onClick={() => search(criteria)} disabled={!canSearch}>
          {isSearching ? <Loader2Icon className="animate-spin" /> : null}
          {isSearching ? t("find.searching") : t("find.search")}
        </Button>
      </div>

      {result && !result.ok && <p className="text-sm text-destructive">{errorText(t, result.error)}</p>}
      {result?.ok && result.games.length === 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <div className="font-semibold">{t("find.emptyTitle")}</div>
          <ul className="list-disc pl-5 text-muted-foreground">
            {(["emptyNoCode", "emptyOtherAccount", "emptyWindow", "emptyRegion"] as const).map((key) => (
              <li key={key}>{t(`find.${key}`)}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.ok && result.games.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold">{t("find.resultsCount", { count: result.games.length })}</div>
          {result.games.map((game) => (
            <GameRow key={game.riotMatchId} game={game} matchId={matchId} teamName={teamName} busy={busy} onPick={() => onPick(game)} t={t} />
          ))}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onBack} disabled={busy}>
          {t("gameImport.back")}
        </Button>
      </DialogFooter>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations>;

function errorText(t: Translate, error: FindGamesError): string {
  switch (error.kind) {
    case "riotIdInvalid":
      return t("find.error.riotIdInvalid", { riotId: error.riotId });
    case "riotIdNotFound":
      return t("find.error.riotIdNotFound", { riotId: error.riotId });
    case "windowInvalid":
      return t("find.error.windowInvalid");
    case "noSeeds":
      return t("find.riotIdRequired");
    case "riotUnavailable":
      return t("gameImport.error.riotUnavailable");
    case "missingConfig":
    case "relayUnauthorized":
    case "riotKeyRejected":
    case "relayLeagueUnavailable":
    case "routeUnavailable":
    case "relayUnreachable":
      return t(`find.error.${error.kind}`);
    default:
      return t("find.error.generic");
  }
}

function GameRow({ game, matchId, teamName, busy, onPick, t }: { game: FoundGame; matchId: number; teamName: (entrantId: number | null) => string; busy: boolean; onPick: () => void; t: Translate }) {
  const foundSide = (["blue", "red"] as const).find((side) => game.sides[side].known > 0 && game.sides[side].entrantId !== null);
  const otherSide = foundSide === undefined ? undefined : foundSide === "blue" ? "red" : "blue";
  const nameMatches = otherSide === undefined ? null : game.sides[otherSide].nameMatches;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <FormattedDate date={game.startedAt} mode="datetime" />
          <span>·</span>
          <span>{t("find.minutes", { minutes: Math.round(game.durationSeconds / 60) })}</span>
          <span>·</span>
          <span className="font-mono">{game.riotMatchId}</span>
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          {(["blue", "red"] as const).map((side) => (
            <div key={side} className="flex items-center gap-2">
              <LolSideBadge side={side} label={t(side === "blue" ? "gameImport.sideBlue" : "gameImport.sideRed")} />
              <span>{t("find.sideSummary", { team: teamName(game.sides[side].entrantId), known: game.sides[side].known, players: game.sides[side].players })}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {game.status === "both" && <Badge variant="secondary">{t("find.badgeBoth")}</Badge>}
          {game.status === "one" && foundSide !== undefined && <Badge variant="outline">{t("find.badgeOne", { name: teamName(game.sides[foundSide].entrantId) })}</Badge>}
          {nameMatches !== null && otherSide !== undefined && game.status === "one" && (
            <Badge variant="outline">{t("find.badgeNames", { count: nameMatches, total: game.sides[otherSide].players, name: teamName(game.sides[otherSide].entrantId) })}</Badge>
          )}
          {game.typedMatches > 0 && (
            <Badge variant={game.typedMatches === game.typedTotal ? "default" : "secondary"}>{t("find.badgeRiotIds", { count: game.typedMatches, total: game.typedTotal })}</Badge>
          )}
          {game.imported && <Badge variant="outline">{game.imported.matchId === matchId ? t("find.badgeImported", { order: game.imported.order }) : t("find.badgeImportedElsewhere")}</Badge>}
          {game.possibleRemake && <Badge variant="destructive">{t("find.badgeRemake")}</Badge>}
        </div>
      </div>
      <Button size="sm" onClick={onPick} disabled={busy || game.imported !== null} className="shrink-0">
        {t("find.use")}
      </Button>
    </div>
  );
}
