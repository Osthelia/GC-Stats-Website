/**
 * GC-Stats - org-access-panel
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPicker } from "@/components/admin/user-picker";
import { RequiredMark } from "@/components/admin/required-mark";
import { RoleChecklist, type RoleChecklistSelection } from "@/components/admin/role-checklist";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  addDashboardOrganizationAccess,
  updateDashboardOrganizationAccessRoles,
  removeDashboardOrganizationAccess,
  searchUsersForOrganization,
  type AddAccessFieldErrors,
  type AccessEntryFieldErrors,
} from "@/actions/dashboard-organizations";
import type { OrganizationRoleSummary } from "@/lib/organization-roles-data";
import type { OrganizationAccessGrant } from "@/lib/organization-access-data";

/** Email is admin-only (see /admin/organizations), never sent to this dashboard component. */
type DashboardAccessGrant = Omit<OrganizationAccessGrant, "email">;

function AccessRow({
  organizationId,
  canManage,
  canGrantOwner,
  roles,
  grant,
  onSaved,
  onDeleted,
}: {
  organizationId: number;
  canManage: boolean;
  canGrantOwner: boolean;
  roles: OrganizationRoleSummary[];
  grant: DashboardAccessGrant;
  onSaved: (updated: DashboardAccessGrant) => void;
  onDeleted: (accessId: number) => void;
}) {
  const t = useTranslations("admin.organizations.edit");
  const tAccess = useTranslations("dashboard.access");
  const [isPending, startTransition] = useTransition();
  const [selection, setSelection] = useState<RoleChecklistSelection>({ isOwner: grant.isOwner, roleIds: grant.roleIds });
  const [fieldErrors, setFieldErrors] = useState<AccessEntryFieldErrors>({});
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  // A non-owner can't touch an owner's grant at all (server-enforced too, see assertCanModifyGrant), falls back to a read-only row for that one card instead of failing on save.
  const canModifyThisGrant = canManage && (grant.isOwner ? canGrantOwner : true);
  const err = (field: keyof AccessEntryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  function handleSave() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateDashboardOrganizationAccessRoles(organizationId, grant.accessId, selection);
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
      const result = await removeDashboardOrganizationAccess(organizationId, grant.accessId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.notFound"));
        return;
      }
      onDeleted(grant.accessId);
      toast.success(tAccess("removeSuccess"));
    });
  }

  const label = grant.username ?? grant.userId;
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
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">{initial}</div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{grant.username ?? tAccess("noUsername")}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {tAccess("roleColumn")}
            <RequiredMark />
          </Label>
          <RoleChecklist
            roles={roles}
            ownerLabel={t("role.owner")}
            showOwnerOption={canGrantOwner || grant.isOwner}
            selection={selection}
            onChange={setSelection}
            disabled={!canModifyThisGrant}
          />
          {err("role") && (
            <p role="alert" className="text-xs text-destructive">
              {err("role")}
            </p>
          )}
        </div>

        {canModifyThisGrant && (
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
          description={tAccess("removeConfirm", { name: grant.username ?? grant.userId })}
          confirmLabel={tAccess("removeButton")}
          cancelLabel={t("cancel")}
          onConfirm={confirmDelete}
          isPending={isPending}
        />
      </div>
    </div>
  );
}

export function OrgAccessPanel({
  organizationId,
  initialGrants,
  roles,
  canManage,
  canGrantOwner,
}: {
  organizationId: number;
  initialGrants: DashboardAccessGrant[];
  roles: OrganizationRoleSummary[];
  canManage: boolean;
  canGrantOwner: boolean;
}) {
  const t = useTranslations("admin.organizations.edit");
  const tAccess = useTranslations("dashboard.access");
  const router = useRouter();
  const [grants, setGrants] = useState(initialGrants);
  const [isPending, startTransition] = useTransition();
  const [user, setUser] = useState<{ id: string; username: string | null } | null>(null);
  // Defaults to no roles selected rather than "Owner": granting ownership should be a deliberate pick, not whatever the checklist happens to open on.
  const [selection, setSelection] = useState<RoleChecklistSelection>({ isOwner: false, roleIds: [] });
  const [fieldErrors, setFieldErrors] = useState<AddAccessFieldErrors>({});

  function handleAdd() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addDashboardOrganizationAccess(organizationId, user?.id ?? null, selection);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setUser(null);
      setSelection({ isOwner: false, roleIds: [] });
      toast.success(tAccess("addSuccess"));
      router.refresh();
    });
  }

  function handleSaved(updated: DashboardAccessGrant) {
    setGrants((prev) => prev.map((g) => (g.accessId === updated.accessId ? updated : g)));
  }

  function handleDeleted(accessId: number) {
    setGrants((prev) => prev.filter((g) => g.accessId !== accessId));
  }

  const err = (field: keyof AddAccessFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  return (
    <div className="flex flex-col gap-4">
      {!canManage && <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{tAccess("readOnlyHint")}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{tAccess("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canManage && (
            <div className="flex flex-col gap-3 border-b pb-4">
              <p className="text-sm font-medium">{tAccess("addTitle")}</p>
              {roles.length === 0 && !canGrantOwner ? (
                <p className="text-sm text-muted-foreground">{tAccess("noRolesYet")}</p>
              ) : (
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
                      search={(q) => searchUsersForOrganization(organizationId, q)}
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
                    <RoleChecklist roles={roles} ownerLabel={t("role.owner")} showOwnerOption={canGrantOwner} selection={selection} onChange={setSelection} />
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
              )}
            </div>
          )}
          {grants.length === 0 && <p className="text-sm text-muted-foreground">{tAccess("empty")}</p>}

          {grants.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grants.map((g) => (
                <AccessRow
                  key={g.accessId}
                  organizationId={organizationId}
                  canManage={canManage}
                  canGrantOwner={canGrantOwner}
                  roles={roles}
                  grant={g}
                  onSaved={handleSaved}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
