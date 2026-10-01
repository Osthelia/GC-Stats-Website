/**
 * GC-Stats - organization-dashboard-access-panel
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
import { Label } from "@/components/ui/label";
import { UserPicker } from "@/components/admin/user-picker";
import { RequiredMark } from "@/components/admin/required-mark";
import { RoleChecklist, type RoleChecklistSelection } from "@/components/admin/role-checklist";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  addOrganizationAccess,
  updateOrganizationAccessRoles,
  removeOrganizationAccess,
  type AddOrgAccessFieldErrors,
  type OrgAccessEntryFieldErrors,
} from "@/actions/admin-organizations";
import type { OrganizationRoleSummary } from "@/lib/organization-roles-data";
import type { OrganizationAccessGrant } from "@/lib/organization-access-data";

/**
 * Who can sign in to /dashboard for this organization, and with what
 * role(s) — entirely separate from OrganizationMembersPanel above (that one
 * is the public credit roster, organization_memberships; this one is
 * organization_access, keyed on real user accounts). Split requested
 * explicitly (2026-09-13): "les membres... sont un visuel (comme player)".
 * Roles themselves (organization_roles) are managed from /dashboard by the
 * organization's own owner — an admin here only picks among whatever
 * already exists, same as an org's own members.manage holder.
 */
function AccessRow({
  organizationId,
  canManage,
  roles,
  grant,
  onSaved,
  onDeleted,
}: {
  organizationId: number;
  canManage: boolean;
  roles: OrganizationRoleSummary[];
  grant: OrganizationAccessGrant;
  onSaved: (updated: OrganizationAccessGrant) => void;
  onDeleted: (accessId: number) => void;
}) {
  const t = useTranslations("admin.organizations.edit");
  const tAccess = useTranslations("dashboard.access");
  const [isPending, startTransition] = useTransition();
  const [selection, setSelection] = useState<RoleChecklistSelection>({ isOwner: grant.isOwner, roleIds: grant.roleIds });
  const [fieldErrors, setFieldErrors] = useState<OrgAccessEntryFieldErrors>({});
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const err = (field: keyof OrgAccessEntryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateOrganizationAccessRoles(organizationId, grant.accessId, selection);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      const roleNames = selection.isOwner ? [] : roles.filter((r) => selection.roleIds.includes(r.id)).map((r) => r.name);
      onSaved({ ...grant, isOwner: selection.isOwner, roleIds: selection.isOwner ? [] : selection.roleIds, roleNames });
      toast.success(tAccess("saveSuccess"));
    });
  }

  function confirmDelete() {
    setRemoveConfirmOpen(false);
    startTransition(async () => {
      const result = await removeOrganizationAccess(organizationId, grant.accessId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.notFound"));
        return;
      }
      onDeleted(grant.accessId);
      toast.success(tAccess("removeSuccess"));
    });
  }

  const label = grant.username ?? grant.email ?? grant.userId;
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className={`h-1 w-full shrink-0 ${grant.isOwner ? "bg-amber-400" : "bg-sky-400"}`} />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-2.5">
          {grant.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={grant.image} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-black">{initial}</div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{grant.username ?? tAccess("noUsername")}</span>
            {grant.email && <span className="truncate text-xs text-muted-foreground">{grant.email}</span>}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {tAccess("roleColumn")}
            <RequiredMark />
          </Label>
          <RoleChecklist roles={roles} ownerLabel={t("role.owner")} showOwnerOption selection={selection} onChange={setSelection} disabled={!canManage} />
          {err("role") && (
            <p role="alert" className="text-xs text-destructive">
              {err("role")}
            </p>
          )}
        </div>

        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleSave} className="flex-1">
              {t("save")}
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setRemoveConfirmOpen(true)} className="text-destructive hover:text-destructive">
              {tAccess("removeButton")}
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={removeConfirmOpen}
          onOpenChange={setRemoveConfirmOpen}
          title={tAccess("removeButton")}
          description={tAccess("removeConfirm", { name: grant.username ?? grant.email ?? grant.userId })}
          confirmLabel={tAccess("removeButton")}
          cancelLabel={t("cancel")}
          onConfirm={confirmDelete}
          isPending={isPending}
        />
      </div>
    </div>
  );
}

export function OrganizationDashboardAccessPanel({
  organizationId,
  initialGrants,
  roles,
  canManage,
}: {
  organizationId: number;
  initialGrants: OrganizationAccessGrant[];
  roles: OrganizationRoleSummary[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.organizations.edit");
  const tAccess = useTranslations("dashboard.access");
  const [grants, setGrants] = useState(initialGrants);
  const [isPending, startTransition] = useTransition();
  const [user, setUser] = useState<{ id: string; username: string | null } | null>(null);
  // Defaults to no roles selected rather than "Owner" — granting ownership should be a deliberate pick, not whatever the checklist happens to open on.
  const [selection, setSelection] = useState<RoleChecklistSelection>({ isOwner: false, roleIds: [] });
  const [fieldErrors, setFieldErrors] = useState<AddOrgAccessFieldErrors>({});

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addOrganizationAccess(organizationId, user?.id ?? null, selection);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setUser(null);
      setSelection({ isOwner: false, roleIds: [] });
      toast.success(tAccess("addSuccess"));
      window.location.reload();
    });
  }

  function handleSaved(updated: OrganizationAccessGrant) {
    setGrants((prev) => prev.map((g) => (g.accessId === updated.accessId ? updated : g)));
  }

  function handleDeleted(accessId: number) {
    setGrants((prev) => prev.filter((g) => g.accessId !== accessId));
  }

  const err = (field: keyof AddOrgAccessFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tAccess("title")}</CardTitle>
        {!canManage && <CardDescription>{tAccess("readOnlyHint")}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {grants.length === 0 && <p className="text-sm text-muted-foreground">{tAccess("empty")}</p>}

        {grants.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grants.map((g) => (
              <AccessRow key={g.accessId} organizationId={organizationId} canManage={canManage} roles={roles} grant={g} onSaved={handleSaved} onDeleted={handleDeleted} />
            ))}
          </div>
        )}

        {canManage && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <p className="text-sm font-medium">{tAccess("addTitle")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>
                  {tAccess("addUserLabel")}
                  <RequiredMark />
                </Label>
                <UserPicker
                  value={user}
                  onChange={setUser}
                  placeholder={tAccess("addUserPlaceholder")}
                  searchPlaceholder={tAccess("addUserSearchPlaceholder")}
                  noResultsLabel={tAccess("addUserNoResults")}
                />
                {err("user") && (
                  <p role="alert" className="text-xs text-destructive">
                    {err("user")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>
                  {tAccess("roleColumn")}
                  <RequiredMark />
                </Label>
                <RoleChecklist roles={roles} ownerLabel={t("role.owner")} showOwnerOption selection={selection} onChange={setSelection} />
                {err("role") && (
                  <p role="alert" className="text-xs text-destructive">
                    {err("role")}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <Button variant="outline" disabled={isPending} onClick={handleAdd} className="w-full">
                  {tAccess("addSubmit")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
