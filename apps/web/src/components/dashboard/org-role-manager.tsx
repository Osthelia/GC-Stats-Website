/**
 * GC-Stats - org-role-manager
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ORGANIZATION_PERMISSION_GROUPS } from "@gc-stats/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { cn } from "@/lib/utils";
import { createOrganizationRole, renameOrganizationRole, deleteOrganizationRole, updateOrganizationRolePermissions, type RoleFieldErrors } from "@/actions/dashboard-organizations";
import type { OrganizationRoleWithPermissions } from "@/lib/organization-roles-data";

const OWNER_TAB = "owner";

/** "organization.news.publish" -> "organization_news_publish", to key into admin.organizations.edit.accessPermissionNames, same i18n keys the admin ceiling editor already uses (dots can't nest in i18n paths), so the two share one translated permission-name catalog. */
function permissionKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

/**
 * Fully self-service role manager for this organization's owner: 'Owner'
 * is a fixed, immutable tab (always every permission up to the ceiling a
 * site admin unlocked, can't be renamed/deleted/edited), every other role
 * is created, renamed, deleted, and permission-edited here, entirely by the
 * organization itself. See organization_roles/organization_access in
 * packages/db/src/schema/people.ts.
 */
export function OrgRoleManager({ organizationId, maxPermissions, initialRoles }: { organizationId: number; maxPermissions: string[]; initialRoles: OrganizationRoleWithPermissions[] }) {
  const t = useTranslations("admin.organizations.edit");
  const tDash = useTranslations("dashboard.permissions");
  const [roles, setRoles] = useState(initialRoles);
  const [activeTab, setActiveTab] = useState<string>(roles[0] ? String(roles[0].id) : OWNER_TAB);
  const [selectedByRole, setSelectedByRole] = useState<Record<number, Set<string>>>(() => Object.fromEntries(initialRoles.map((r) => [r.id, new Set(r.permissions)])));
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createErrors, setCreateErrors] = useState<RoleFieldErrors>({});

  const [renaming, setRenaming] = useState<OrganizationRoleWithPermissions | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameErrors, setRenameErrors] = useState<RoleFieldErrors>({});

  const [deleting, setDeleting] = useState<OrganizationRoleWithPermissions | null>(null);

  const ceiling = useMemo(() => new Set(maxPermissions), [maxPermissions]);
  const activeRole = activeTab === OWNER_TAB ? null : (roles.find((r) => String(r.id) === activeTab) ?? null);
  const selected = activeRole ? (selectedByRole[activeRole.id] ?? new Set<string>()) : ceiling;
  const roleNameError = (errors: RoleFieldErrors) => (errors.name ? tDash(`error.${errors.name}` as "error.required") : undefined);

  function toggle(name: string) {
    if (!activeRole) return;
    setSelectedByRole((prev) => {
      const next = new Set(prev[activeRole.id] ?? []);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...prev, [activeRole.id]: next };
    });
  }

  function handleSave() {
    if (!activeRole) return;
    startTransition(async () => {
      const result = await updateOrganizationRolePermissions(organizationId, activeRole.id, [...selected]);
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.invalidRole"));
        return;
      }
      toast.success(tDash("saveSuccess"));
    });
  }

  function handleCreate() {
    setCreateErrors({});
    startTransition(async () => {
      const result = await createOrganizationRole(organizationId, createName);
      if (!result.ok) {
        setCreateErrors(result.fieldErrors);
        return;
      }
      const created: OrganizationRoleWithPermissions = { id: result.id, name: createName.trim(), permissions: [] };
      setRoles((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedByRole((prev) => ({ ...prev, [created.id]: new Set() }));
      setActiveTab(String(created.id));
      setCreateOpen(false);
      setCreateName("");
      toast.success(tDash("roleCreated"));
    });
  }

  function openRename(role: OrganizationRoleWithPermissions) {
    setRenaming(role);
    setRenameName(role.name);
    setRenameErrors({});
  }

  function handleRename() {
    if (!renaming) return;
    startTransition(async () => {
      const result = await renameOrganizationRole(organizationId, renaming.id, renameName);
      if (!result.ok) {
        setRenameErrors(result.fieldErrors);
        return;
      }
      const trimmed = renameName.trim();
      setRoles((prev) => prev.map((r) => (r.id === renaming.id ? { ...r, name: trimmed } : r)).sort((a, b) => a.name.localeCompare(b.name)));
      setRenaming(null);
      toast.success(tDash("roleRenamed"));
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const role = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteOrganizationRole(organizationId, role.id);
      if (!result.ok) {
        toast.error(tDash(`error.${result.error}` as "error.roleInUse"));
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      setSelectedByRole((prev) => {
        const next = { ...prev };
        delete next[role.id];
        return next;
      });
      if (activeTab === String(role.id)) setActiveTab(OWNER_TAB);
      toast.success(tDash("roleDeleted"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tDash("title")}</CardTitle>
        <CardDescription>{tDash("hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="rounded-lg border border-dashed border-primary/40 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">{tDash("ceilingHint")}</p>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={tDash("roleColumn")}>
          <button
            type="button"
            aria-pressed={activeTab === OWNER_TAB}
            onClick={() => setActiveTab(OWNER_TAB)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-all hover:-translate-y-0.5",
              activeTab === OWNER_TAB ? "border-amber-400 bg-amber-400 text-black" : "border-border bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t("role.owner")}
          </button>

          {roles.map((role) => (
            <div key={role.id} className="flex items-center gap-0.5">
              <button
                type="button"
                aria-pressed={activeTab === String(role.id)}
                onClick={() => setActiveTab(String(role.id))}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-all hover:-translate-y-0.5",
                  activeTab === String(role.id) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {role.name}
              </button>
              <button type="button" aria-label={tDash("renameButton")} onClick={() => openRename(role)} className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground">
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                aria-label={tDash("deleteButton")}
                onClick={() => setDeleting(role)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" className="ml-1 h-7 gap-1 rounded-full px-3" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            {tDash("createRole")}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {ORGANIZATION_PERMISSION_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(`accessPermissionGroups.${group.key}`)}</h3>
              <div className="flex flex-col gap-1.5">
                {group.permissions.map((name) => {
                  const allowed = ceiling.has(name);
                  const checked = activeRole ? allowed && selected.has(name) : allowed;
                  return (
                    <label key={name} className={cn("flex items-center gap-2.5 text-sm", !allowed && "opacity-40")}>
                      <Checkbox checked={checked} disabled={!allowed || !activeRole} onCheckedChange={() => toggle(name)} />
                      {t(`accessPermissionNames.${permissionKey(name)}`)}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {activeRole ? (
          <div>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {tDash("save")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{tDash("ownerNote")}</p>
        )}
      </CardContent>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) {
            setCreateName("");
            setCreateErrors({});
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDash("createRoleDialogTitle")}</DialogTitle>
            <DialogDescription>{tDash("createRoleDialogDescription")}</DialogDescription>
          </DialogHeader>
          <FormField label={tDash("roleNameLabel")} htmlFor="dashboard-role-create-name" required error={roleNameError(createErrors)}>
            <Input id="dashboard-role-create-name" value={createName} onChange={(e) => setCreateName(e.target.value)} aria-invalid={!!createErrors.name} />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isPending}>
              {tDash("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {tDash("createRoleSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renaming !== null}
        onOpenChange={(next) => {
          if (!next) setRenaming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDash("renameRoleDialogTitle")}</DialogTitle>
          </DialogHeader>
          <FormField label={tDash("roleNameLabel")} htmlFor="dashboard-role-rename-name" required error={roleNameError(renameErrors)}>
            <Input id="dashboard-role-rename-name" value={renameName} onChange={(e) => setRenameName(e.target.value)} aria-invalid={!!renameErrors.name} />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)} disabled={isPending}>
              {tDash("cancel")}
            </Button>
            <Button onClick={handleRename} disabled={isPending}>
              {tDash("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        title={tDash("deleteButton")}
        description={deleting ? tDash("deleteConfirm", { name: deleting.name }) : ""}
        confirmLabel={tDash("deleteButton")}
        cancelLabel={tDash("cancel")}
        onConfirm={confirmDelete}
        isPending={isPending}
      />
    </Card>
  );
}
