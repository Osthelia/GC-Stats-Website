/**
 * GC-Stats - ghost-match-dialog
 *
 * Creates a GC team's match in an uncovered mix tournament, with its ghost
 * tournament, ghost opponent and ghost players, then opens the admin match
 * page for the usual map fetch.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/admin/form-field";
import { RequiredMark } from "@/components/admin/required-mark";
import { TeamPicker } from "@/components/admin/team-picker";
import { PersonPicker } from "@/components/admin/person-picker";
import {
  createGhostMatch,
  getGhostTeamLastPlayers,
  getTeamCurrentPlayers,
  searchGhostPeople,
  searchGhostTeams,
  searchPeopleIncludingGhosts,
  type GhostMatchFieldErrors,
} from "@/actions/admin-ghost-matches";
import type { PersonPickerResult } from "@/lib/person-search";
import { GHOST_MATCH_BEST_OF_VALUES, GHOST_MATCH_PLAYER_SLOTS } from "@/lib/ghost-match";

type Slot = { person: { id: number; handle: string } | null; handle: string };

const emptySlots = (): Slot[] => Array.from({ length: GHOST_MATCH_PLAYER_SLOTS }, () => ({ person: null, handle: "" }));

const slotsFrom = (players: { id: number; handle: string }[]): Slot[] =>
  emptySlots().map((slot, i) => (players[i] ? { person: players[i], handle: "" } : slot));

function PlayerSlots({
  idPrefix,
  label,
  slots,
  onChange,
  search,
  errors,
  disabled,
}: {
  idPrefix: string;
  label: string;
  slots: Slot[];
  onChange: (slots: Slot[]) => void;
  search: (query: string) => Promise<PersonPickerResult[]>;
  errors?: Record<number, string>;
  disabled: boolean;
}) {
  const t = useTranslations("admin.tournaments.ghostMatch");
  const update = (i: number, next: Slot) => onChange(slots.map((s, j) => (j === i ? next : s)));

  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label}
        <RequiredMark />
      </Label>
      {slots.map((slot, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <PersonPicker
                  value={slot.person}
                  onChange={(person) => update(i, { person, handle: "" })}
                  placeholder={t("playerPickPlaceholder", { n: i + 1 })}
                  searchPlaceholder={t("searchPlaceholder")}
                  noResultsLabel={t("noResults")}
                  search={search}
                />
              </div>
              {slot.person && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => update(i, { person: null, handle: "" })} aria-label={t("clear")} disabled={disabled}>
                  <XIcon />
                </Button>
              )}
            </div>
            <span className="text-center text-xs text-muted-foreground">{t("or")}</span>
            <Input
              id={`${idPrefix}-${i}`}
              value={slot.handle}
              onChange={(e) => update(i, { person: null, handle: e.target.value })}
              placeholder={t("newHandlePlaceholder")}
              disabled={disabled || !!slot.person}
              aria-invalid={!!errors?.[i]}
            />
          </div>
          {errors?.[i] && (
            <p role="alert" className="text-xs text-destructive">
              {t(`error.${errors[i]}`)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function GhostMatchDialog() {
  const t = useTranslations("admin.tournaments.ghostMatch");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<GhostMatchFieldErrors>({});

  const [tournamentName, setTournamentName] = useState("");
  const [stageName, setStageName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [bestOf, setBestOf] = useState<string>("3");
  const [gcTeam, setGcTeam] = useState<{ id: number; name: string } | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<{ id: number; name: string } | null>(null);
  const [opponentTeamName, setOpponentTeamName] = useState("");
  const [gcSlots, setGcSlots] = useState<Slot[]>(emptySlots);
  const [opponentSlots, setOpponentSlots] = useState<Slot[]>(emptySlots);

  function reset() {
    setTournamentName("");
    setStageName("");
    setScheduledAt("");
    setBestOf("3");
    setGcTeam(null);
    setOpponentTeam(null);
    setOpponentTeamName("");
    setGcSlots(emptySlots());
    setOpponentSlots(emptySlots());
    setFieldErrors({});
  }

  function pickGcTeam(team: { id: number; name: string } | null) {
    setGcTeam(team);
    if (!team) return;
    startTransition(async () => setGcSlots(slotsFrom(await getTeamCurrentPlayers(team.id))));
  }

  function pickOpponentTeam(team: { id: number; name: string } | null) {
    setOpponentTeam(team);
    setOpponentTeamName("");
    if (!team) return;
    startTransition(async () => setOpponentSlots(slotsFrom(await getGhostTeamLastPlayers(team.id))));
  }

  function handleSubmit() {
    setFieldErrors({});
    const toInput = (slots: Slot[]) => slots.map((s) => ({ personId: s.person?.id ?? null, handle: s.handle }));
    startTransition(async () => {
      const result = await createGhostMatch({
        tournamentName,
        stageName,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : "",
        bestOf,
        gcTeamId: gcTeam?.id ?? null,
        opponentTeamId: opponentTeam?.id ?? null,
        opponentTeamName,
        gcPlayers: toInput(gcSlots),
        opponentPlayers: toInput(opponentSlots),
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setOpen(false);
      reset();
      toast.success(t("success"));
      router.push(`/admin/tournaments/${result.tournamentId}/matches/${result.matchId}`);
    });
  }

  const err = (field: Exclude<keyof GhostMatchFieldErrors, "gcPlayers" | "opponentPlayers">) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("fieldTournament")} htmlFor="ghost-tournament" required error={err("tournamentName")} hint={t("fieldTournamentHint")}>
                <Input id="ghost-tournament" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} aria-invalid={!!fieldErrors.tournamentName} />
              </FormField>
              <FormField label={t("fieldStage")} htmlFor="ghost-stage" required error={err("stageName")}>
                <Input id="ghost-stage" value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder={t("fieldStagePlaceholder")} aria-invalid={!!fieldErrors.stageName} />
              </FormField>
              <FormField label={t("fieldScheduledAt")} htmlFor="ghost-scheduled-at" required error={err("scheduledAt")}>
                <Input id="ghost-scheduled-at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} aria-invalid={!!fieldErrors.scheduledAt} />
              </FormField>
              <FormField label={t("fieldBestOf")} htmlFor="ghost-best-of" required error={err("bestOf")}>
                <Select items={Object.fromEntries(GHOST_MATCH_BEST_OF_VALUES.map((v) => [v, `BO${v}`]))} value={bestOf} onValueChange={(v) => v && setBestOf(v)}>
                  <SelectTrigger id="ghost-best-of" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GHOST_MATCH_BEST_OF_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        BO{v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("fieldGcTeam")} htmlFor="ghost-gc-team" required error={err("gcTeamId")}>
                <TeamPicker value={gcTeam} onChange={pickGcTeam} placeholder={t("teamPickPlaceholder")} searchPlaceholder={t("searchPlaceholder")} noResultsLabel={t("noResults")} />
              </FormField>
              <FormField label={t("fieldOpponent")} htmlFor="ghost-opponent-name" required error={err("opponent")}>
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <TeamPicker
                      value={opponentTeam}
                      onChange={pickOpponentTeam}
                      placeholder={t("opponentPickPlaceholder")}
                      searchPlaceholder={t("searchPlaceholder")}
                      noResultsLabel={t("noResults")}
                      search={searchGhostTeams}
                    />
                  </div>
                  {opponentTeam && (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => pickOpponentTeam(null)} aria-label={t("clear")} disabled={isPending}>
                      <XIcon />
                    </Button>
                  )}
                </div>
                <Input
                  id="ghost-opponent-name"
                  value={opponentTeamName}
                  onChange={(e) => setOpponentTeamName(e.target.value)}
                  placeholder={t("opponentNewPlaceholder")}
                  disabled={!!opponentTeam}
                  aria-invalid={!!fieldErrors.opponent}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PlayerSlots
                idPrefix="ghost-gc-player"
                label={t("gcPlayers")}
                slots={gcSlots}
                onChange={setGcSlots}
                search={searchPeopleIncludingGhosts}
                errors={fieldErrors.gcPlayers}
                disabled={isPending}
              />
              <PlayerSlots
                idPrefix="ghost-opponent-player"
                label={t("opponentPlayers")}
                slots={opponentSlots}
                onChange={setOpponentSlots}
                search={searchGhostPeople}
                errors={fieldErrors.opponentPlayers}
                disabled={isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
