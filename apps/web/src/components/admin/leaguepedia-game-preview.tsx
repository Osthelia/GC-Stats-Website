/**
 * GC-Stats - leaguepedia-game-preview
 *
 * The second step of a Leaguepedia game: the teams, winner, players and champions, the role of each player
 * (inferred from the positions, changeable by the admin), the entrant for blue and red, and a link to a
 * person for every Riot account that is not linked yet. Nothing is stored until Save.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { PersonPicker } from "@/components/admin/person-picker";
import { commitLeaguepediaGameForMatch, type LeaguepediaPreview, type PlayerMapping, type PreviewPlayer } from "@/actions/admin-leaguepedia";
import { cn } from "@/lib/utils";
import type { LeagueSide } from "@gc-stats/lol-stats-engine";

type PersonChoice = { id: number; handle: string };
type Mapping = { mode: "existing" | "create"; person: PersonChoice | null; handle: string };

const NO_ROLE = "none";
const ROLE_OPTIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

export function LeaguepediaGamePreview({
  tournamentId,
  matchId,
  gameId,
  leaguepediaGameId,
  order,
  preview,
  onBack,
  onSaved,
}: {
  tournamentId: number;
  matchId: number;
  /** The game being edited, null when creating one. */
  gameId: number | null;
  leaguepediaGameId: string;
  order: number;
  preview: LeaguepediaPreview;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.tournaments.matches.games");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sides, setSides] = useState<Partial<Record<LeagueSide, number>>>({ blue: preview.suggestedSides?.blue, red: preview.suggestedSides?.red });
  const [roles, setRoles] = useState<Record<string, string | null>>(() => Object.fromEntries(preview.players.map((p) => [p.puuid, p.role])));
  const unlinked = preview.players.filter((p) => p.person === null);
  const [mappings, setMappings] = useState<Record<string, Mapping>>(() =>
    Object.fromEntries(unlinked.map((p) => [p.puuid, { mode: "existing", person: null, handle: p.riotId.split("#")[0] ?? "" } satisfies Mapping]))
  );

  const entrantName = (id: number | undefined) => preview.entrants.find((e) => e.id === id)?.name ?? "";
  const entrantItems = Object.fromEntries(preview.entrants.map((e) => [String(e.id), e.name]));
  const sidesChosen = sides.blue !== undefined && sides.red !== undefined && sides.blue !== sides.red;
  const mappingsResolved = unlinked.every((p) => {
    const m = mappings[p.puuid];
    return m !== undefined && (m.mode === "existing" ? m.person !== null : m.handle.trim() !== "");
  });
  const canSave = sidesChosen && mappingsResolved && !isPending;
  const winnerName = preview.winner && sides[preview.winner] !== undefined ? entrantName(sides[preview.winner]) : null;
  const winnerText = preview.winner ? t("leaguepedia.winnerLabel", { name: winnerName || t(preview.winner === "blue" ? "leaguepedia.sideBlue" : "leaguepedia.sideRed") }) : t("leaguepedia.noWinner");

  function setMapping(puuid: string, next: Partial<Mapping>) {
    setMappings((prev) => ({ ...prev, [puuid]: { ...prev[puuid]!, ...next } }));
  }

  function handleSave() {
    startTransition(async () => {
      const mappingList: PlayerMapping[] = unlinked.map((p) => {
        const m = mappings[p.puuid]!;
        return m.mode === "existing" ? { puuid: p.puuid, personId: m.person!.id, createHandle: null } : { puuid: p.puuid, personId: null, createHandle: m.handle.trim() };
      });
      // Only the roles the admin changed from the inferred ones are kept; the others keep following the inference.
      const roleOverrides = Object.fromEntries(preview.players.filter((p) => (roles[p.puuid] ?? null) !== p.inferredRole).map((p) => [p.puuid, roles[p.puuid] ?? null]));
      const result = await commitLeaguepediaGameForMatch(tournamentId, matchId, {
        mode: preview.mode,
        gameId,
        leaguepediaGameId,
        order,
        entrantIdBySide: { blue: sides.blue!, red: sides.red! },
        mappings: mappingList,
        roleOverrides,
      });
      if (!result.ok) {
        const count = result.error.kind === "missingPlayers" ? result.error.count : 0;
        const ids = result.error.kind === "unknownChampions" ? result.error.ids.join(", ") : "";
        const description = result.error.kind === "storeFailed" ? result.error.message : result.error.kind === "invalidUpload" ? result.error.errors.join("; ") : undefined;
        toast.error(t(`leaguepedia.error.${result.error.kind}`, { count, order, ids }), { description });
        return;
      }
      onSaved();
      router.refresh();
      toast.success(t("leaguepedia.success"));
    });
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1 text-sm">
        <div className="font-semibold">{t("gameLabel", { order })}</div>
        <div className="text-muted-foreground">{winnerText}</div>
        <div className="text-muted-foreground">{t("leaguepedia.lengthLabel", { minutes: Math.round(preview.durationSeconds / 60) })}</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold">{t("leaguepedia.sidesTitle")}</div>
        {(["blue", "red"] as const).map((side) => (
          <FormField key={side} label={t(side === "blue" ? "leaguepedia.blueSide" : "leaguepedia.redSide")} htmlFor={`side-${side}`}>
            <Select items={entrantItems} value={sides[side] !== undefined ? String(sides[side]) : ""} onValueChange={(v) => setSides((prev) => ({ ...prev, [side]: Number(v) }))}>
              <SelectTrigger id={`side-${side}`} className="w-full">
                <SelectValue placeholder={t("leaguepedia.chooseEntrant")} />
              </SelectTrigger>
              <SelectContent>
                {preview.entrants.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ))}
        {preview.suggestionFrom && (
          <p className="text-xs text-muted-foreground">{t(preview.suggestionFrom === "players" ? "leaguepedia.suggestedPlayers" : "leaguepedia.suggestedNames")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">{t("leaguepedia.playersTitle")}</div>
        {preview.players.map((p) => (
          <PlayerRow
            key={p.puuid}
            player={p}
            role={roles[p.puuid] ?? null}
            onRoleChange={(role) => setRoles((prev) => ({ ...prev, [p.puuid]: role }))}
            mapping={mappings[p.puuid]}
            onChange={(next) => setMapping(p.puuid, next)}
            sideLabel={t(p.side === "blue" ? "leaguepedia.sideBlue" : "leaguepedia.sideRed")}
          />
        ))}
        {unlinked.length > 0 && <p className="text-xs text-muted-foreground">{t("leaguepedia.unresolvedHint")}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          {t("leaguepedia.back")}
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {isPending ? t("saving") : t("leaguepedia.saveGame")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function PlayerRow({
  player,
  role,
  onRoleChange,
  mapping,
  onChange,
  sideLabel,
}: {
  player: PreviewPlayer;
  role: string | null;
  onRoleChange: (role: string | null) => void;
  mapping: Mapping | undefined;
  onChange: (next: Partial<Mapping>) => void;
  sideLabel: string;
}) {
  const t = useTranslations("admin.tournaments.matches.games");
  const kda = `${player.kills} / ${player.deaths} / ${player.assists}`;
  const roleItems: Record<string, string> = { [NO_ROLE]: t("leaguepedia.roleNone"), ...Object.fromEntries(ROLE_OPTIONS.map((r) => [r, r])) };

  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 text-sm">
        <div className="flex items-center gap-2">
          <span className={cn("rounded px-1.5 text-[10px] font-semibold uppercase", player.side === "blue" ? "bg-sky-500/15 text-sky-400" : "bg-rose-500/15 text-rose-400")}>{sideLabel}</span>
          <span className="truncate font-medium">{player.riotId}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {player.championName} · {kda}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Select items={roleItems} value={role ?? NO_ROLE} onValueChange={(v) => onRoleChange(v === NO_ROLE ? null : (v as string))}>
            <SelectTrigger className="h-7 w-32 text-xs" aria-label={t("leaguepedia.roleLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ROLE}>{t("leaguepedia.roleNone")}</SelectItem>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{t("leaguepedia.riotRole", { role: player.riotRole ?? "—" })}</span>
        </div>
      </div>

      <div className="min-w-0">
        {player.person ? (
          <div className="text-sm">{player.person.handle}</div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant={mapping?.mode === "existing" ? "default" : "outline"} onClick={() => onChange({ mode: "existing" })}>
                {t("leaguepedia.linkExisting")}
              </Button>
              <Button size="sm" variant={mapping?.mode === "create" ? "default" : "outline"} onClick={() => onChange({ mode: "create" })}>
                {t("leaguepedia.createNew")}
              </Button>
            </div>
            {mapping?.mode === "existing" ? (
              <PersonPicker
                value={mapping.person}
                onChange={(person) => onChange({ person: person ? { id: person.id, handle: person.handle } : null })}
                placeholder={t("leaguepedia.notLinked")}
                searchPlaceholder={t("leaguepedia.linkExisting")}
                noResultsLabel={t("leaguepedia.noResults")}
              />
            ) : (
              <Input value={mapping?.handle ?? ""} onChange={(e) => onChange({ handle: e.target.value })} placeholder={t("leaguepedia.newHandle")} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
