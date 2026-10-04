/**
 * GC-Stats - map-fetch-controls
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { PersonPicker } from "@/components/admin/person-picker";
import { searchPeopleForMapFetch } from "@/actions/admin-ghost-matches";
import {
  fetchMapData,
  renewMapData,
  mergeMapSegments,
  type FetchMapError,
  type MissingPuuidPlayer,
  type TeamColorRoster,
  type RiotRelayError,
  type RiotRelayRegion,
} from "@/actions/admin-map-fetch";
import { RIOT_RELAY_REGIONS } from "@/lib/riot-relay-client";

function relayErrorKey(error: RiotRelayError): string {
  switch (error.kind) {
    case "missingConfig":
      return "error.missingConfig";
    case "invalidRequest":
      return "error.invalidRequest";
    case "relayUnauthorized":
      return "error.relayUnauthorized";
    case "riotUnauthorized":
      return "error.riotUnauthorized";
    case "notFound":
      return "error.notFound";
    case "rateLimited":
      return "error.rateLimited";
    case "relayUnreachable":
      return "error.relayUnreachable";
    case "cacheUnavailable":
      return "error.cacheUnavailable";
    case "riotError":
      return "error.riotError";
    case "networkError":
      return "error.networkError";
    case "invalidResponse":
      return "error.invalidResponse";
    default:
      return "error.unknown";
  }
}

function fetchErrorKey(error: FetchMapError): string {
  switch (error.kind) {
    case "mapNotFound":
      return "error.mapNotFound";
    case "noMatchId":
      return "error.noMatchId";
    case "entrantsNotSet":
      return "error.entrantsNotSet";
    case "regionNotConfigured":
      return "error.regionNotConfigured";
    case "invalidResponse":
      return "error.invalidResponse";
    case "puuidConflict":
      return "error.puuidConflict";
    case "duplicateMatchId":
      return "error.duplicateMatchId";
    case "relay":
      return relayErrorKey(error.relayError);
    default:
      return "error.unknown";
  }
}

function MissingPuuidsDialog({
  mapId,
  players,
  pending,
  onCancel,
  onResolve,
}: {
  mapId: number;
  players: MissingPuuidPlayer[];
  pending: boolean;
  onCancel: () => void;
  onResolve: (mapping: Record<string, number>) => void;
}) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const [selections, setSelections] = useState<Record<string, { id: number; handle: string } | null>>({});
  const allResolved = players.every((p) => selections[p.puuid]);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("missingPuuidsTitle")}</DialogTitle>
          <DialogDescription>{t("missingPuuidsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {players.map((p) => (
            <div key={p.puuid} className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">{p.displayName}</div>
                <div className="text-xs text-muted-foreground">
                  {p.agentName} · {p.teamColor}
                </div>
              </div>
              <div className="w-48">
                <PersonPicker
                  value={selections[p.puuid] ?? null}
                  onChange={(person) => setSelections((prev) => ({ ...prev, [p.puuid]: person }))}
                  placeholder={t("personPickerPlaceholder")}
                  searchPlaceholder={t("personPickerSearchPlaceholder")}
                  noResultsLabel={t("personPickerNoResults")}
                  search={(query) => searchPeopleForMapFetch(mapId, query)}
                />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button disabled={pending || !allResolved} onClick={() => onResolve(Object.fromEntries(players.map((p) => [p.puuid, selections[p.puuid]!.id])))}>
            {pending ? t("fetching") : t("resolveAndRetry")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamColorAmbiguousDialog({
  rosters,
  pending,
  onCancel,
  onSelect,
}: {
  rosters: TeamColorRoster[];
  pending: boolean;
  onCancel: () => void;
  onSelect: (color: "Red" | "Blue") => void;
}) {
  const t = useTranslations("admin.tournaments.matches.maps");

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("teamColorAmbiguousTitle")}</DialogTitle>
          <DialogDescription>{t("teamColorAmbiguousDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-2">
          {rosters.map((roster) => (
            <div key={roster.color} className="flex flex-col gap-4 rounded-lg border p-5">
              <span className="text-base font-semibold">{roster.color}</span>

              {/* Riot's own Account API display name (gameName#tagLine) + agent — never the raw puuid, which stays an internal id only. */}
              <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                {roster.players.map((p) => (
                  <li key={p.displayName} className="flex items-center justify-between gap-3">
                    <span className="truncate">{p.displayName}</span>
                    <span className="shrink-0 text-xs">{p.agentName}</span>
                  </li>
                ))}
              </ul>

              <Button size="lg" className="w-full" disabled={pending} onClick={() => onSelect(roster.color)}>
                {t("selectAsTeamA")}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onCancel} disabled={pending}>
            {t("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SegmentInput = { matchId: string; startRound: string; endRound: string };
function emptySegment(): SegmentInput {
  return { matchId: "", startRound: "", endRound: "" };
}

function MergeSegmentsDialog({
  mapId,
  open,
  onOpenChange,
  onMerged,
}: {
  mapId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: (apiMatchId: string) => void;
}) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const [isPending, startTransition] = useTransition();
  const [region, setRegion] = useState<RiotRelayRegion>("na");
  const [segments, setSegments] = useState<SegmentInput[]>([emptySegment(), emptySegment()]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRegion("na");
      setSegments([emptySegment(), emptySegment()]);
      setError(null);
    }
  }, [open]);

  function updateSegment(index: number, patch: Partial<SegmentInput>) {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await mergeMapSegments(mapId, { region, segments });
      if (!result.ok) {
        if (result.fieldErrors) {
          const code = Object.values(result.fieldErrors)[0];
          setError(t(`error.merge${code!.charAt(0).toUpperCase()}${code!.slice(1)}`));
        } else if (result.error) {
          setError(t(relayErrorKey(result.error)));
        }
        return;
      }
      onMerged(result.apiMatchId);
      onOpenChange(false);
      toast.success(t("mergeSuccess"));
    });
  }

  const regionItems: Record<string, string> = Object.fromEntries(RIOT_RELAY_REGIONS.map((r) => [r, r.toUpperCase()]));

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("mergeTitle")}</DialogTitle>
          <DialogDescription>{t("mergeDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FormField label={t("mergeRegion")} htmlFor="merge-region" required>
            <Select items={regionItems} value={region} onValueChange={(v) => v && setRegion(v as RiotRelayRegion)}>
              <SelectTrigger id="merge-region" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RIOT_RELAY_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex flex-col gap-3">
            {segments.map((segment, index) => (
              <div key={index} className="grid grid-cols-[1fr_6rem_6rem_auto] items-end gap-2">
                <FormField label={t("mergeSegmentMatchId")} htmlFor={`merge-matchid-${index}`} required>
                  <Input id={`merge-matchid-${index}`} className="font-mono text-xs" value={segment.matchId} onChange={(e) => updateSegment(index, { matchId: e.target.value })} />
                </FormField>
                <FormField label={t("mergeSegmentStartRound")} htmlFor={`merge-start-${index}`} required>
                  <Input id={`merge-start-${index}`} type="number" min={1} value={segment.startRound} onChange={(e) => updateSegment(index, { startRound: e.target.value })} />
                </FormField>
                <FormField label={t("mergeSegmentEndRound")} htmlFor={`merge-end-${index}`} required>
                  <Input id={`merge-end-${index}`} type="number" min={1} value={segment.endRound} onChange={(e) => updateSegment(index, { endRound: e.target.value })} />
                </FormField>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={segments.length <= 2}
                  onClick={() => setSegments((prev) => prev.filter((_, i) => i !== index))}
                >
                  {t("mergeRemoveSegment")}
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" className="self-start" disabled={segments.length >= 5} onClick={() => setSegments((prev) => [...prev, emptySegment()])}>
            {t("mergeAddSegment")}
          </Button>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : t("mergeButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MapFetchControls({
  mapId,
  apiMatchId,
  canManage,
  onMerged,
}: {
  mapId: number;
  apiMatchId: string | null;
  canManage: boolean;
  onMerged: (apiMatchId: string) => void;
}) {
  const t = useTranslations("admin.tournaments.matches.maps");
  const router = useRouter();
  const [fetchPending, startFetch] = useTransition();
  const [renewPending, startRenew] = useTransition();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [missingPuuids, setMissingPuuids] = useState<MissingPuuidPlayer[] | null>(null);
  const [ambiguousRosters, setAmbiguousRosters] = useState<TeamColorRoster[] | null>(null);

  function showFetchError(error: FetchMapError) {
    // Only one follow-up dialog at a time: resolving puuids can lead straight
    // to the team color question, which must replace the puuid dialog.
    setMissingPuuids(error.kind === "missingPuuids" ? error.players : null);
    setAmbiguousRosters(error.kind === "teamColorAmbiguous" ? error.rosters : null);
    if (error.kind === "missingPuuids" || error.kind === "teamColorAmbiguous") return;
    if (error.kind === "relay" && error.relayError.kind === "rateLimited") {
      const seconds = error.relayError.retryAfterSeconds;
      toast.error(seconds ? t("error.rateLimitedWithSeconds", { seconds }) : t("error.rateLimited"));
      return;
    }
    toast.error(t(fetchErrorKey(error)));
  }

  function runFetch(options?: { puuidMapping?: Record<string, number>; teamAColor?: "Red" | "Blue" }) {
    startFetch(async () => {
      // The match id currently in the field, saved or not, so editing it never fetches the old one.
      const result = await fetchMapData(mapId, { ...options, apiMatchId: apiMatchId ?? "" });
      if (!result.ok) {
        showFetchError(result.error);
        return;
      }
      setMissingPuuids(null);
      setAmbiguousRosters(null);
      router.refresh();
      toast.success(t("fetchSuccess"));
    });
  }

  function handleRenew() {
    startRenew(async () => {
      const result = await renewMapData(mapId, apiMatchId ?? "");
      if (!result.ok) {
        if (result.error.kind === "mapNotFound" || result.error.kind === "noMatchId" || result.error.kind === "regionNotConfigured" || result.error.kind === "duplicateMatchId") {
          toast.error(t(`error.${result.error.kind}`));
        } else if (result.error.kind === "rateLimited") {
          const seconds = result.error.retryAfterSeconds;
          toast.error(seconds ? t("error.rateLimitedWithSeconds", { seconds }) : t("error.rateLimited"));
        } else {
          toast.error(t(relayErrorKey(result.error)));
        }
        return;
      }
      toast.success(t("renewSuccess"));
    });
  }

  if (!canManage) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button variant="outline" size="sm" disabled={!apiMatchId || fetchPending} onClick={() => runFetch()}>
        {fetchPending ? t("fetching") : t("fetchButton")}
      </Button>
      <Button variant="outline" size="sm" disabled={!apiMatchId || renewPending} onClick={handleRenew}>
        {renewPending ? t("renewing") : t("renewButton")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
        {t("mergeButton")}
      </Button>

      {missingPuuids && <MissingPuuidsDialog mapId={mapId} players={missingPuuids} pending={fetchPending} onCancel={() => setMissingPuuids(null)} onResolve={(mapping) => runFetch({ puuidMapping: mapping })} />}
      {ambiguousRosters && (
        <TeamColorAmbiguousDialog rosters={ambiguousRosters} pending={fetchPending} onCancel={() => setAmbiguousRosters(null)} onSelect={(color) => runFetch({ teamAColor: color })} />
      )}
      <MergeSegmentsDialog mapId={mapId} open={mergeOpen} onOpenChange={setMergeOpen} onMerged={onMerged} />
    </div>
  );
}
