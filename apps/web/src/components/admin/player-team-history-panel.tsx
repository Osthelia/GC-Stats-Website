/**
 * GC-Stats - player-team-history-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TeamPicker } from "@/components/admin/team-picker";
import { CountryFlag } from "@/components/admin/country-flag";
import { RequiredMark } from "@/components/admin/required-mark";
import {
  addPlayerTeamHistoryEntry,
  updatePlayerTeamHistoryEntry,
  type AddTeamHistoryFieldErrors,
  type TeamHistoryEntryFieldErrors,
} from "@/actions/admin-players";
import { deleteRosterMembership } from "@/actions/admin-teams";
import { ROSTER_ROLES, rosterRoleStyles } from "@/lib/roster-roles";
import { cn } from "@/lib/utils";
import type { AdminPlayerTeamHistoryEntry } from "@/lib/admin-players";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const roleItemsFor = (t: ReturnType<typeof useTranslations>) => Object.fromEntries(ROSTER_ROLES.map((r) => [r, t(`role.${r}` as "role.player")]));

/**
 * One team-history card, editable in place — player-side mirror of
 * admin/team-roster-panel.tsx's RosterRow (see that file for the V1
 * roster-entry-card rationale: role/joined/left/inactive as real inputs on
 * every card, current or past).
 */
function TeamHistoryCard({
  entry,
  canEdit,
  onSaved,
  onDeleted,
}: {
  entry: AdminPlayerTeamHistoryEntry;
  canEdit: boolean;
  onSaved: (updated: AdminPlayerTeamHistoryEntry) => void;
  onDeleted: (membershipId: number) => void;
}) {
  const t = useTranslations("admin.players.edit");
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<(typeof ROSTER_ROLES)[number]>(entry.role as (typeof ROSTER_ROLES)[number]);
  const [from, setFrom] = useState(entry.since ?? today());
  const [until, setUntil] = useState(entry.until ?? "");
  const [inactiveSince, setInactiveSince] = useState(entry.inactiveSince ?? "");
  const [fieldErrors, setFieldErrors] = useState<TeamHistoryEntryFieldErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const roleItems = roleItemsFor(t);
  const err = (field: keyof TeamHistoryEntryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updatePlayerTeamHistoryEntry(entry.membershipId, role, from, until, inactiveSince);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onSaved({ ...entry, role, since: from, until: until || null, isCurrent: !until, inactiveSince: inactiveSince || null });
      toast.success(t("historyAddSubmit"));
    });
  }

  function handleDelete() {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await deleteRosterMembership(entry.membershipId);
      if (!result.ok) {
        toast.error(t("historyDeleteError"));
        return;
      }
      onDeleted(entry.membershipId);
      toast.success(t("historyDelete"));
    });
  }

  const styles = rosterRoleStyles(role, !!inactiveSince);
  const initial = entry.teamName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className={cn("h-1 w-full shrink-0", styles.bar)} />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-black", styles.badgeBg, styles.badgeText)}>{initial}</div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5 truncate font-medium">
              <CountryFlag code={entry.teamCountryCode} secondaryCode={entry.teamSecondaryCountryCode} className="size-3.5 shrink-0" />
              <span className="truncate">{entry.teamName}</span>
            </div>
            {!entry.isCurrent && (
              <Badge variant="outline" className="w-fit">
                {t("historyPast")}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">
              {t("historyAddRole")}
              <RequiredMark />
            </Label>
            <Select items={roleItems} value={role} onValueChange={(v) => v && setRole(v as (typeof ROSTER_ROLES)[number])} disabled={!canEdit}>
              <SelectTrigger aria-label={t("historyAddRole")} aria-invalid={!!fieldErrors.role} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROSTER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleItems[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("role") && (
              <p role="alert" className="text-xs text-destructive">
                {err("role")}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("historyAddFromLabel")}
                <RequiredMark />
              </Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldErrors.from} disabled={!canEdit} />
              {err("from") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("from")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">{t("historyAddUntilLabel")}</Label>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-invalid={!!fieldErrors.until} disabled={!canEdit} />
              {err("until") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("until")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">{t("historyInactiveSinceLabel")}</Label>
            <Input type="date" value={inactiveSince} onChange={(e) => setInactiveSince(e.target.value)} aria-invalid={!!fieldErrors.inactiveSince} disabled={!canEdit} />
            {err("inactiveSince") && (
              <p role="alert" className="text-xs text-destructive">
                {err("inactiveSince")}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleSave} className="flex-1">
              {t("save")}
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setConfirmOpen(true)} className="text-destructive hover:text-destructive">
              {t("historyDelete")}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmTitle")}
        description={t("historyDeleteConfirm", { team: entry.teamName })}
        confirmLabel={t("historyDelete")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </div>
  );
}

export function PlayerTeamHistoryPanel({
  playerId,
  initialEntries,
  canEdit,
}: {
  playerId: number;
  initialEntries: AdminPlayerTeamHistoryEntry[];
  canEdit: boolean;
}) {
  const t = useTranslations("admin.players.edit");
  const [entries, setEntries] = useState(initialEntries);
  const [isPending, startTransition] = useTransition();
  const [team, setTeam] = useState<{ id: number; name: string } | null>(null);
  const [role, setRole] = useState<(typeof ROSTER_ROLES)[number]>("player");
  const [from, setFrom] = useState(today());
  const [until, setUntil] = useState("");
  const [inactiveSince, setInactiveSince] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AddTeamHistoryFieldErrors>({});

  const roleItems = roleItemsFor(t);

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addPlayerTeamHistoryEntry(playerId, team?.id ?? null, role, from, until, inactiveSince || null);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setTeam(null);
      setFrom(today());
      setUntil("");
      setInactiveSince("");
      // No toast here: redundant with the reload below (which is itself the
      // visual feedback) and would get cut off before it could ever be seen.
      // Same reasoning as team-roster-panel.tsx: a full refresh picks up any
      // membership this add silently closed elsewhere.
      window.location.reload();
    });
  }

  function handleEntrySaved(updated: AdminPlayerTeamHistoryEntry) {
    setEntries((prev) => prev.map((e) => (e.membershipId === updated.membershipId ? updated : e)));
  }

  function handleEntryDeleted(membershipId: number) {
    setEntries((prev) => prev.filter((e) => e.membershipId !== membershipId));
  }

  const err = (field: keyof AddTeamHistoryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  const byRecent = (a: AdminPlayerTeamHistoryEntry, b: AdminPlayerTeamHistoryEntry) => (b.since ?? "").localeCompare(a.since ?? "");
  const current = entries.filter((e) => e.isCurrent).sort(byRecent);
  const past = entries.filter((e) => !e.isCurrent).sort(byRecent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionHistory")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit && (
        <div className="flex flex-col gap-3 border-b pb-4">
          <p className="text-sm font-medium">{t("historyAddTitle")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("historyAddTeamLabel")}
                <RequiredMark />
              </Label>
              <TeamPicker
                value={team}
                onChange={setTeam}
                placeholder={t("historyAddTeamPlaceholder")}
                searchPlaceholder={t("historyAddTeamSearchPlaceholder")}
                noResultsLabel={t("historyAddTeamNoResults")}
              />
              {err("team") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("team")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("historyAddRole")}
                <RequiredMark />
              </Label>
              <Select items={roleItems} value={role} onValueChange={(v) => v && setRole(v as (typeof ROSTER_ROLES)[number])}>
                <SelectTrigger aria-label={t("historyAddRole")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROSTER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleItems[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err("role") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("role")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="history-inactive-since">{t("historyInactiveSinceLabel")}</Label>
              <Input id="history-inactive-since" type="date" value={inactiveSince} onChange={(e) => setInactiveSince(e.target.value)} aria-invalid={!!fieldErrors.inactiveSince} />
              {err("inactiveSince") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("inactiveSince")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="history-from">
                {t("historyAddFromLabel")}
                <RequiredMark />
              </Label>
              <Input id="history-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldErrors.from} />
              {err("from") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("from")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="history-until">{t("historyAddUntilLabel")}</Label>
              <Input id="history-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-invalid={!!fieldErrors.until} />
              {err("until") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("until")}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <Button variant="outline" disabled={isPending} onClick={handleAdd} className="w-full">
                {t("historyAddSubmit")}
              </Button>
            </div>
          </div>
        </div>
        )}
        {entries.length === 0 && <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>}

        {/* Current and history share one container (this Card) — same card
            format for both, just a title splitting the two groups, mirroring
            V1's roster-panel.blade.php. */}
        {current.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {current.map((entry) => (
              <TeamHistoryCard key={entry.membershipId} entry={entry} canEdit={canEdit} onSaved={handleEntrySaved} onDeleted={handleEntryDeleted} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{t("historyPastTitle")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {past.map((entry) => (
                <TeamHistoryCard key={entry.membershipId} entry={entry} canEdit={canEdit} onSaved={handleEntrySaved} onDeleted={handleEntryDeleted} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
