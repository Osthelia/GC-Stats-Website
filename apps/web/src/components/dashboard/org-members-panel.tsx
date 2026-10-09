/**
 * GC-Stats - org-members-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonPicker } from "@/components/admin/person-picker";
import { UserPicker } from "@/components/admin/user-picker";
import { CountryFlag } from "@/components/admin/country-flag";
import { RequiredMark } from "@/components/admin/required-mark";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreatePersonDialog } from "@/components/dashboard/create-person-dialog";
import { EditPersonProfileDialog } from "@/components/dashboard/edit-person-profile-dialog";
import {
  addDashboardOrganizationMember,
  updateDashboardOrganizationMember,
  deleteDashboardOrganizationMembership,
  searchPeopleForNewOrganizationMember,
  searchUsersForPersonLink,
  linkDashboardOrganizationMemberUser,
  unlinkDashboardOrganizationMemberUser,
  type AddMemberFieldErrors,
  type MemberEntryFieldErrors,
} from "@/actions/dashboard-organizations";
import { ORGANIZATION_MEMBER_ROLES } from "@/lib/organization-roles";
import type { AdminOrganizationMember } from "@/lib/admin-organizations";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const roleItemsFor = (t: ReturnType<typeof useTranslations>) =>
  Object.fromEntries(ORGANIZATION_MEMBER_ROLES.map((r) => [r, t(`role.${r}` as "role.owner")]));

/** Per-row linked-account control, gated by the separate peopleLinkUser permission, condensed sibling of admin's PlayerLinkedAccountCard (no Card wrapper, this already lives inside one). */
function LinkedAccountRow({ organizationId, member, onChanged }: { organizationId: number; member: AdminOrganizationMember; onChanged: (linkedUserId: string | null, linkedUsername: string | null) => void }) {
  const t = useTranslations("dashboard.members");
  const [isPending, startTransition] = useTransition();
  const [picked, setPicked] = useState<{ id: string; username: string | null } | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);

  function handleLink() {
    if (!picked) return;
    startTransition(async () => {
      const result = await linkDashboardOrganizationMemberUser(organizationId, member.personId, picked.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.invalid"));
        return;
      }
      setPicked(null);
      onChanged(picked.id, picked.username);
      toast.success(t("linkedAccountLink"));
    });
  }

  function confirmUnlink() {
    setUnlinkConfirmOpen(false);
    startTransition(async () => {
      const result = await unlinkDashboardOrganizationMemberUser(organizationId, member.personId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.invalid"));
        return;
      }
      onChanged(null, null);
      toast.success(t("linkedAccountUnlink"));
    });
  }

  return (
    <div className="flex flex-col gap-1.5 border-t pt-2">
      <Label className="text-[11px] text-muted-foreground">{t("linkedAccountLabel")}</Label>
      {member.linkedUserId ? (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{member.linkedUsername ?? member.linkedUserId}</span>
          <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setUnlinkConfirmOpen(true)} className="text-destructive hover:text-destructive">
            {t("linkedAccountUnlink")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <UserPicker
            value={picked}
            onChange={setPicked}
            placeholder={t("linkedAccountPlaceholder")}
            searchPlaceholder={t("linkedAccountSearchPlaceholder")}
            noResultsLabel={t("linkedAccountNoResults")}
            search={(q) => searchUsersForPersonLink(organizationId, q)}
          />
          <Button variant="outline" size="sm" disabled={isPending || !picked} onClick={handleLink}>
            {t("linkedAccountLink")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={unlinkConfirmOpen}
        onOpenChange={setUnlinkConfirmOpen}
        title={t("linkedAccountUnlink")}
        description={t("linkedAccountUnlinkConfirm", { username: member.linkedUsername ?? member.linkedUserId ?? "", handle: member.handle })}
        confirmLabel={t("linkedAccountUnlink")}
        cancelLabel={t("createPersonCancel")}
        onConfirm={confirmUnlink}
        isPending={isPending}
      />
    </div>
  );
}

/** One membership row, editable in place, dashboard sibling of admin's MemberRow (organization-members-panel.tsx), same table/actions, never the same component (admin/dashboard split). */
function MemberRow({
  organizationId,
  canManage,
  canLinkUser,
  canEditProfile,
  member,
  onSaved,
  onDeleted,
}: {
  organizationId: number;
  canManage: boolean;
  canLinkUser: boolean;
  canEditProfile: boolean;
  member: AdminOrganizationMember;
  onSaved: (updated: AdminOrganizationMember) => void;
  onDeleted: (membershipId: number) => void;
}) {
  const t = useTranslations("admin.organizations.edit");
  const tMembers = useTranslations("dashboard.members");
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<(typeof ORGANIZATION_MEMBER_ROLES)[number]>(member.role as (typeof ORGANIZATION_MEMBER_ROLES)[number]);
  const [from, setFrom] = useState(member.since ?? today());
  const [until, setUntil] = useState(member.until ?? "");
  const [fieldErrors, setFieldErrors] = useState<MemberEntryFieldErrors>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const roleItems = roleItemsFor(t);
  const err = (field: keyof MemberEntryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateDashboardOrganizationMember(organizationId, member.membershipId, role, from, until);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onSaved({ ...member, role, since: from, until: until || null, isCurrent: !until });
      toast.success(tMembers("saveSuccess"));
    });
  }

  function confirmDelete() {
    setDeleteConfirmOpen(false);
    startTransition(async () => {
      const result = await deleteDashboardOrganizationMembership(organizationId, member.membershipId);
      if (!result.ok) {
        toast.error(tMembers("removeError"));
        return;
      }
      onDeleted(member.membershipId);
      toast.success(tMembers("removeSuccess"));
    });
  }

  const initial = member.handle.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className={`h-1 w-full shrink-0 ${role === "owner" ? "bg-amber-400" : "bg-sky-400"}`} />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">{initial}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
          {canEditProfile && (
            <EditPersonProfileDialog organizationId={organizationId} personId={member.personId} handle={member.handle} onSaved={(newHandle) => onSaved({ ...member, handle: newHandle })} />
          )}
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
              {isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setDeleteConfirmOpen(true)} className="text-destructive hover:text-destructive">
              {t("memberDelete")}
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title={t("memberDelete")}
          description={t("memberDeleteConfirm", { handle: member.handle })}
          confirmLabel={t("memberDelete")}
          cancelLabel={t("cancel")}
          onConfirm={confirmDelete}
          isPending={isPending}
        />

        {canLinkUser && (
          <LinkedAccountRow
            organizationId={organizationId}
            member={member}
            onChanged={(linkedUserId, linkedUsername) => onSaved({ ...member, linkedUserId, linkedUsername })}
          />
        )}
      </div>
    </div>
  );
}

export function OrgMembersPanel({
  organizationId,
  initialMembers,
  canManage,
  canCreatePerson,
  canLinkUser,
  canEditProfile,
}: {
  organizationId: number;
  initialMembers: AdminOrganizationMember[];
  canManage: boolean;
  canCreatePerson: boolean;
  canLinkUser: boolean;
  canEditProfile: boolean;
}) {
  const t = useTranslations("admin.organizations.edit");
  const tMembers = useTranslations("dashboard.members");
  const router = useRouter();
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
      const result = await addDashboardOrganizationMember(organizationId, person?.id ?? null, role, from, until);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setPerson(null);
      setFrom(today());
      setUntil("");
      toast.success(tMembers("addSuccess"));
      // Adding a member can silently close another open stint for the same
      // (person, org, role) triple server-side, so a router refresh is the
      // simplest way to reflect that without hand-rolling the same logic
      // client-side, same tradeoff as the admin panel.
      router.refresh();
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
    <div className="flex flex-col gap-4">
      {!canManage && <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{tMembers("readOnlyHint")}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{tMembers("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{tMembers("hint")}</p>

          {canManage && (
            <div className="flex flex-col gap-3 border-b pb-4">
              <p className="text-sm font-medium">{t("memberAddTitle")}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label>
                    {t("memberAddPersonLabel")}
                    <RequiredMark />
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <PersonPicker
                      value={person}
                      onChange={setPerson}
                      placeholder={t("memberAddPersonPlaceholder")}
                      searchPlaceholder={t("memberAddPersonSearchPlaceholder")}
                      noResultsLabel={t("memberAddPersonNoResults")}
                      search={(q) => searchPeopleForNewOrganizationMember(organizationId, q)}
                    />
                    {canCreatePerson && <CreatePersonDialog organizationId={organizationId} onCreated={setPerson} />}
                  </div>
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
                  <Label htmlFor="dashboard-member-from">
                    {t("memberAddFromLabel")}
                    <RequiredMark />
                  </Label>
                  <Input id="dashboard-member-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldErrors.from} />
                  {err("from") && (
                    <p role="alert" className="text-xs text-destructive">
                      {err("from")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dashboard-member-until">{t("memberAddUntilLabel")}</Label>
                  <Input id="dashboard-member-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-invalid={!!fieldErrors.until} />
                  {err("until") && (
                    <p role="alert" className="text-xs text-destructive">
                      {err("until")}
                    </p>
                  )}
                </div>
                <div className="flex items-end">
                  <Button variant="outline" disabled={isPending} onClick={handleAdd} className="w-full">
                    {isPending ? (
                      <>
                        <Loader2Icon className="size-3.5 animate-spin" />
                        {t("memberAddSubmitting")}
                      </>
                    ) : (
                      t("memberAddSubmit")
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {members.length === 0 && <p className="text-sm text-muted-foreground">{tMembers("empty")}</p>}

          {current.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {current.map((m) => (
                <MemberRow key={m.membershipId} organizationId={organizationId} canManage={canManage} canLinkUser={canLinkUser} canEditProfile={canEditProfile} member={m} onSaved={handleRowSaved} onDeleted={handleRowDeleted} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{t("memberHistoryTitle")}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((m) => (
                  <MemberRow key={m.membershipId} organizationId={organizationId} canManage={canManage} canLinkUser={canLinkUser} canEditProfile={canEditProfile} member={m} onSaved={handleRowSaved} onDeleted={handleRowDeleted} />
                ))}
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
