/**
 * GC-Stats - organization-members-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonPicker } from "@/components/admin/person-picker";
import { CountryFlag } from "@/components/admin/country-flag";
import { RequiredMark } from "@/components/admin/required-mark";
import {
  addOrganizationMember,
  updateOrganizationMember,
  deleteOrganizationMembership,
  type AddMemberFieldErrors,
  type MemberEntryFieldErrors,
} from "@/actions/admin-organizations";
import { ORGANIZATION_MEMBER_ROLES } from "@/lib/organization-roles";
import type { AdminOrganizationMember } from "@/lib/admin-organizations";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const roleItemsFor = (t: ReturnType<typeof useTranslations>) =>
  Object.fromEntries(ORGANIZATION_MEMBER_ROLES.map((r) => [r, t(`role.${r}` as "role.owner")]));

/** One membership row, editable in place — mirrors TeamRosterPanel's RosterRow, without the inactive-since concept (organization_memberships has no such column). */
function MemberRow({
  canManage,
  member,
  onSaved,
  onDeleted,
}: {
  canManage: boolean;
  member: AdminOrganizationMember;
  onSaved: (updated: AdminOrganizationMember) => void;
  onDeleted: (membershipId: number) => void;
}) {
  const t = useTranslations("admin.organizations.edit");
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<(typeof ORGANIZATION_MEMBER_ROLES)[number]>(member.role as (typeof ORGANIZATION_MEMBER_ROLES)[number]);
  const [from, setFrom] = useState(member.since ?? today());
  const [until, setUntil] = useState(member.until ?? "");
  const [fieldErrors, setFieldErrors] = useState<MemberEntryFieldErrors>({});

  const roleItems = roleItemsFor(t);
  const err = (field: keyof MemberEntryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateOrganizationMember(member.membershipId, role, from, until);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onSaved({ ...member, role, since: from, until: until || null, isCurrent: !until });
      toast.success(t("memberAddSubmit"));
    });
  }

  function handleDelete() {
    if (!window.confirm(t("memberDeleteConfirm", { handle: member.handle }))) return;
    startTransition(async () => {
      const result = await deleteOrganizationMembership(member.membershipId);
      if (!result.ok) return;
      onDeleted(member.membershipId);
      toast.success(t("memberDelete"));
    });
  }

  const initial = member.handle.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className={`h-1 w-full shrink-0 ${role === "owner" ? "bg-amber-400" : "bg-sky-400"}`} />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-black">{initial}</div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5 truncate font-medium">
              <CountryFlag code={member.countryCode} secondaryCode={member.secondaryCountryCode} className="size-3.5 shrink-0" />
              <span className="truncate">{member.handle}</span>
            </div>
            {!member.isCurrent && (
              <Badge variant="outline" className="w-fit">
                {t("memberPast")}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">
              {t("memberAddRole")}
              <RequiredMark />
            </Label>
            <Select items={roleItems} value={role} onValueChange={(v) => v && setRole(v as (typeof ORGANIZATION_MEMBER_ROLES)[number])} disabled={!canManage}>
              <SelectTrigger aria-label={t("memberAddRole")} aria-invalid={!!fieldErrors.role} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_MEMBER_ROLES.map((r) => (
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
                {t("memberAddFromLabel")}
                <RequiredMark />
              </Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldErrors.from} disabled={!canManage} />
              {err("from") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("from")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">{t("memberAddUntilLabel")}</Label>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-invalid={!!fieldErrors.until} disabled={!canManage} />
              {err("until") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("until")}
                </p>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleSave} className="flex-1">
              {t("save")}
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={handleDelete} className="text-destructive hover:text-destructive">
              {t("memberDelete")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function OrganizationMembersPanel({ organizationId, initialMembers, canManage }: { organizationId: number; initialMembers: AdminOrganizationMember[]; canManage: boolean }) {
  const t = useTranslations("admin.organizations.edit");
  const [members, setMembers] = useState(initialMembers);
  const [isPending, startTransition] = useTransition();
  const [person, setPerson] = useState<{ id: number; handle: string } | null>(null);
  const [role, setRole] = useState<(typeof ORGANIZATION_MEMBER_ROLES)[number]>("owner");
  const [from, setFrom] = useState(today());
  const [until, setUntil] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AddMemberFieldErrors>({});

  const roleItems = roleItemsFor(t);

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addOrganizationMember(organizationId, person?.id ?? null, role, from, until);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setPerson(null);
      setFrom(today());
      setUntil("");
      toast.success(t("memberAddSubmit"));
      // Adding a member can silently close another open stint for the same
      // (person, org, role) triple server-side — a full reload is the
      // simplest way to reflect that without hand-rolling the same logic
      // client-side, same tradeoff as TeamRosterPanel.
      window.location.reload();
    });
  }

  function handleRowSaved(updated: AdminOrganizationMember) {
    setMembers((prev) => prev.map((m) => (m.membershipId === updated.membershipId ? updated : m)));
  }

  function handleRowDeleted(membershipId: number) {
    setMembers((prev) => prev.filter((m) => m.membershipId !== membershipId));
  }

  const err = (field: keyof AddMemberFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  const byRecent = (a: AdminOrganizationMember, b: AdminOrganizationMember) => (b.since ?? "").localeCompare(a.since ?? "");
  const current = members.filter((m) => m.isCurrent).sort(byRecent);
  const past = members.filter((m) => !m.isCurrent).sort(byRecent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionMembers")}</CardTitle>
        <CardDescription>{t("membersHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {members.length === 0 && <p className="text-sm text-muted-foreground">{t("membersEmpty")}</p>}

        {current.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((m) => (
              <MemberRow key={m.membershipId} canManage={canManage} member={m} onSaved={handleRowSaved} onDeleted={handleRowDeleted} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{t("memberHistoryTitle")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((m) => (
                <MemberRow key={m.membershipId} canManage={canManage} member={m} onSaved={handleRowSaved} onDeleted={handleRowDeleted} />
              ))}
            </div>
          </div>
        )}

        {canManage && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <p className="text-sm font-medium">{t("memberAddTitle")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>
                  {t("memberAddPersonLabel")}
                  <RequiredMark />
                </Label>
                <PersonPicker
                  value={person}
                  onChange={setPerson}
                  placeholder={t("memberAddPersonPlaceholder")}
                  searchPlaceholder={t("memberAddPersonSearchPlaceholder")}
                  noResultsLabel={t("memberAddPersonNoResults")}
                />
                {err("person") && (
                  <p role="alert" className="text-xs text-destructive">
                    {err("person")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>
                  {t("memberAddRole")}
                  <RequiredMark />
                </Label>
                <Select items={roleItems} value={role} onValueChange={(v) => v && setRole(v as (typeof ORGANIZATION_MEMBER_ROLES)[number])}>
                  <SelectTrigger aria-label={t("memberAddRole")} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORGANIZATION_MEMBER_ROLES.map((r) => (
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
                <Label htmlFor="org-member-from">
                  {t("memberAddFromLabel")}
                  <RequiredMark />
                </Label>
                <Input id="org-member-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldErrors.from} />
                {err("from") && (
                  <p role="alert" className="text-xs text-destructive">
                    {err("from")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org-member-until">{t("memberAddUntilLabel")}</Label>
                <Input id="org-member-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-invalid={!!fieldErrors.until} />
                {err("until") && (
                  <p role="alert" className="text-xs text-destructive">
                    {err("until")}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <Button variant="outline" disabled={isPending} onClick={handleAdd} className="w-full">
                  {t("memberAddSubmit")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
