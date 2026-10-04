/**
 * GC-Stats - users-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RoleNameBadge } from "@/components/admin/role-name-badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { updateUserGlobalRoles } from "@/actions/admin-users";
import type { AdminUserRole, AdminUserRow, SortDirection } from "@/lib/admin-users";
import { useDisplayTimezone } from "@/lib/site-settings";

export function UsersTable({
  users,
  globalRoles,
  canManageRoles,
  canViewConnections,
  sortable,
}: {
  users: AdminUserRow[];
  globalRoles: AdminUserRole[];
  /** Role assignment is super-admin-only (see actions/admin-users.ts::updateUserGlobalRoles) — hide the entry point otherwise. */
  canManageRoles: boolean;
  /** users.view-connections — hides the email column. */
  canViewConnections: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.users");
  const locale = useLocale();
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  const timeZone = useDisplayTimezone();
  const formatDate = (d: Date | null) => (d ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(d)) : t("never"));

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTh pathname={sortable.pathname} col="username" label={t("columnUser")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              {canViewConnections && (
                <AdminSortableTh pathname={sortable.pathname} col="email" label={t("columnEmail")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              )}
              <TableHead>{t("columnRoles")}</TableHead>
              <AdminSortableTh pathname={sortable.pathname} col="createdAt" label={t("columnJoined")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="lastLoginAt" label={t("columnLastLogin")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={canViewConnections ? 6 : 5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Link href={`/admin/users/${user.id}`} className="flex w-fit items-center gap-2.5 hover:underline">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.image ?? undefined} alt="" />
                      <AvatarFallback>{(user.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.username ?? "-"}</span>
                  </Link>
                </TableCell>
                {canViewConnections && <TableCell className="text-muted-foreground">{user.email ?? "-"}</TableCell>}
                <TableCell>
                  {user.roles.length === 0 ? (
                    <span className="text-sm text-muted-foreground">{t("noRoles")}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <RoleNameBadge key={role.id} name={role.name} isSuperAdmin={role.isSuperAdmin} />
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(user.lastLoginAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" render={<Link href={`/admin/users/${user.id}`} />}>
                      {t("view")}
                    </Button>
                    {canManageRoles && (
                      <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
                        {t("editRoles")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditRolesDialog
        key={editing?.id ?? "none"}
        user={editing}
        globalRoles={globalRoles}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function EditRolesDialog({
  user,
  globalRoles,
  onClose,
}: {
  user: AdminUserRow | null;
  globalRoles: AdminUserRole[];
  onClose: () => void;
}) {
  const t = useTranslations("admin.users");
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(user?.roles.map((r) => r.id)));
  const [error, setError] = useState<string | null>(null);

  function toggle(roleId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  function handleSave() {
    if (!user) return;
    setError(null);
    startTransition(async () => {
      const result = await updateUserGlobalRoles(user.id, [...selected]);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("saveSuccess"));
      onClose();
    });
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? t("editRolesTitle", { username: user.username ?? user.email ?? "" }) : ""}</DialogTitle>
          <DialogDescription>{t("editRolesDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {globalRoles.map((role) => (
            <label key={role.id} className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={selected.has(role.id)} onCheckedChange={() => toggle(role.id)} />
              {role.name}
            </label>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(`error.${error}`)}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
