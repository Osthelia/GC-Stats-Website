/**
 * GC-Stats - team-roster-panel
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PersonPicker } from "@/components/admin/person-picker";
import { CountryFlag } from "@/components/admin/country-flag";
import { RequiredMark } from "@/components/admin/required-mark";
import { useRosterConflicts } from "@/components/admin/roster-conflict-dialog";
import { addTeamRosterMember, updateRosterMemberEntry, deleteRosterMembership, type AddRosterMemberFieldErrors, type RosterEntryFieldErrors } from "@/actions/admin-teams";
import { ROSTER_ROLES, rosterRoleStyles } from "@/lib/roster-roles";
import { cn } from "@/lib/utils";
import type { AdminTeamRosterMember } from "@/lib/admin-teams";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const roleItemsFor = (t: ReturnType<typeof useTranslations>) => Object.fromEntries(ROSTER_ROLES.map((r) => [r, t(`role.${r}` as "role.player")]));

/**
 * One roster row, editable in place — mirrors V1's roster-entry-card:
 * role/joined_at/left_at (here also inactive_since) are real inputs on
 * every card, current or past, not just newly-added ones.
 */
function RosterRow({ member, teamId, onSaved, onDeleted }: { member: AdminTeamRosterMember; teamId: number; onSaved: (updated: AdminTeamRosterMember) => void; onDeleted: (membershipId: number) => void }) {
  const t = useTranslations("admin.teams.edit");
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<(typeof ROSTER_ROLES)[number]>(member.role as (typeof ROSTER_ROLES)[number]);
  const [from, setFrom] = useState(member.since ?? today());
  const [until, setUntil] = useState(member.until ?? "");
  const [inactiveSince, setInactiveSince] = useState(member.inactiveSince ?? "");
  const [fieldErrors, setFieldErrors] = useState<RosterEntryFieldErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { resolveConflicts, dialog: conflictDialog } = useRosterConflicts();

  const roleItems = roleItemsFor(t);
  const err = (field: keyof RosterEntryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  async function handleSave() {
    setFieldErrors({});
    const closeIds = until ? [] : await resolveConflicts(member.personId, member.handle, teamId, member.membershipId);
    if (!closeIds) return;
    startTransition(async () => {
      const result = await updateRosterMemberEntry(member.membershipId, role, from, until, inactiveSince, closeIds);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onSaved({ ...member, role, since: from, until: until || null, isCurrent: !until, inactiveSince: inactiveSince || null });
      toast.success(t("rosterAddSubmit"));
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRosterMembership(member.membershipId);
      if (!result.ok) {
        setConfirmOpen(false);
        toast.error(t(`rosterDeleteError.${result.error}` as "rosterDeleteError.notFound"));
        return;
      }
      onDeleted(member.membershipId);
      toast.success(t("rosterDelete"));
    });
  }

  // Mirrors V1's roster-entry-card accent: a colored bar + role badge tint,
  // grouped by role (igl/player/sub/manager/staff), overridden to a neutral
  // gray whenever the stint is marked inactive — see RosterRole::group().
  const styles = rosterRoleStyles(role, !!inactiveSince);
  const initial = member.handle.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className={cn("h-1 w-full shrink-0", styles.bar)} />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-black", styles.badgeBg, styles.badgeText)}>{initial}</div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5 truncate font-medium">
              <CountryFlag code={member.countryCode} secondaryCode={member.secondaryCountryCode} className="size-3.5 shrink-0" />
              <span className="truncate">{member.handle}</span>
            </div>
            {!member.isCurrent && (
              <Badge variant="outline" className="w-fit">
                {t("rosterPast")}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">
              {t("rosterAddRole")}
              <RequiredMark />
            </Label>
            <Select items={roleItems} value={role} onValueChange={(v) => v && setRole(v as (typeof ROSTER_ROLES)[number])}>
              <SelectTrigger aria-label={t("rosterAddRole")} aria-invalid={!!fieldErrors.role} className="w-full">
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
                {t("rosterAddFromLabel")}
                <RequiredMark />
              </Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldErrors.from} />
              {err("from") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("from")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">{t("rosterAddUntilLabel")}</Label>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-invalid={!!fieldErrors.until} />
              {err("until") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("until")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">{t("rosterInactiveSinceLabel")}</Label>
            <Input type="date" value={inactiveSince} onChange={(e) => setInactiveSince(e.target.value)} aria-invalid={!!fieldErrors.inactiveSince} />
            {err("inactiveSince") && (
              <p role="alert" className="text-xs text-destructive">
                {err("inactiveSince")}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={isPending} onClick={handleSave} className="flex-1">
            {t("save")}
          </Button>
          <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setConfirmOpen(true)} className="text-destructive hover:text-destructive">
            {t("rosterDelete")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmTitle")}
        description={t("rosterDeleteConfirm", { handle: member.handle })}
        confirmLabel={t("rosterDelete")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
        destructive
      />
      {conflictDialog}
    </div>
  );
}

export function TeamRosterPanel({ teamId, initialMembers }: { teamId: number; initialMembers: AdminTeamRosterMember[] }) {
  const t = useTranslations("admin.teams.edit");
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [isPending, startTransition] = useTransition();
  const [person, setPerson] = useState<{ id: number; handle: string } | null>(null);
  const [role, setRole] = useState<(typeof ROSTER_ROLES)[number]>("player");
  const [from, setFrom] = useState(today());
  const [until, setUntil] = useState("");
  const [inactiveSince, setInactiveSince] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AddRosterMemberFieldErrors>({});
  const { resolveConflicts, dialog: conflictDialog } = useRosterConflicts();

  const roleItems = roleItemsFor(t);

  async function handleAdd() {
    setFieldErrors({});
    const closeIds = person && !until ? await resolveConflicts(person.id, person.handle, teamId) : [];
    if (!closeIds) return;
    startTransition(async () => {
      const result = await addTeamRosterMember(teamId, person?.id ?? null, role, from, until, inactiveSince || null, closeIds);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setPerson(null);
      setFrom(today());
      setUntil("");
      setInactiveSince("");
      toast.success(t("rosterAddSubmit"));
      // Refresh from the server instead of patching local state by hand.
      router.refresh();
    });
  }

  function handleRowSaved(updated: AdminTeamRosterMember) {
    setMembers((prev) => prev.map((m) => (m.membershipId === updated.membershipId ? updated : m)));
  }

  function handleRowDeleted(membershipId: number) {
    setMembers((prev) => prev.filter((m) => m.membershipId !== membershipId));
  }

  const err = (field: keyof AddRosterMemberFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  const byRecent = (a: AdminTeamRosterMember, b: AdminTeamRosterMember) => (b.since ?? "").localeCompare(a.since ?? "");
  const current = members.filter((m) => m.isCurrent).sort(byRecent);
  const past = members.filter((m) => !m.isCurrent).sort(byRecent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionRoster")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {members.length === 0 && <p className="text-sm text-muted-foreground">{t("rosterEmpty")}</p>}

        {/* Current and history share one container (this Card) — same card
            format for both, just a title splitting the two groups, mirroring
            V1's roster-panel.blade.php (single form, "current" grid then a
            historyTitle then the "history" grid). */}
        {current.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {current.map((m) => (
              <RosterRow key={m.membershipId} member={m} teamId={teamId} onSaved={handleRowSaved} onDeleted={handleRowDeleted} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{t("rosterHistoryTitle")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {past.map((m) => (
                <RosterRow key={m.membershipId} member={m} teamId={teamId} onSaved={handleRowSaved} onDeleted={handleRowDeleted} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">{t("rosterAddTitle")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("rosterAddPersonLabel")}
                <RequiredMark />
              </Label>
              <PersonPicker
                value={person}
                onChange={setPerson}
                placeholder={t("rosterAddPersonPlaceholder")}
                searchPlaceholder={t("rosterAddPersonSearchPlaceholder")}
                noResultsLabel={t("rosterAddPersonNoResults")}
              />
              {err("person") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("person")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("rosterAddRole")}
                <RequiredMark />
              </Label>
              <Select items={roleItems} value={role} onValueChange={(v) => v && setRole(v as (typeof ROSTER_ROLES)[number])}>
                <SelectTrigger aria-label={t("rosterAddRole")} className="w-full">
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
              <Label htmlFor="roster-inactive-since">{t("rosterInactiveSinceLabel")}</Label>
              <Input id="roster-inactive-since" type="date" value={inactiveSince} onChange={(e) => setInactiveSince(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roster-from">
                {t("rosterAddFromLabel")}
                <RequiredMark />
              </Label>
              <Input id="roster-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldErrors.from} />
              {err("from") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("from")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roster-until">{t("rosterAddUntilLabel")}</Label>
              <Input id="roster-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-invalid={!!fieldErrors.until} />
              {err("until") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("until")}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <Button variant="outline" disabled={isPending} onClick={handleAdd} className="w-full">
                {t("rosterAddSubmit")}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      {conflictDialog}
    </Card>
  );
}
