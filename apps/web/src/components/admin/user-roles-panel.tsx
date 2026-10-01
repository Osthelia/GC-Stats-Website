/**
 * GC-Stats - user-roles-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RoleNameBadge } from "@/components/admin/role-name-badge";
import { updateUserGlobalRoles } from "@/actions/admin-users";
import type { AdminUserRole } from "@/lib/admin-users";

export function UserRolesPanel({
  userId,
  currentRoles,
  allRoles,
  canManage,
}: {
  userId: string;
  currentRoles: AdminUserRole[];
  allRoles: AdminUserRole[];
  /** Role assignment is super-admin-only, see actions/admin-users.ts::updateUserGlobalRoles */
  canManage: boolean;
}) {
  const t = useTranslations("admin.users");
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(currentRoles.map((r) => r.id)));
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
    setError(null);
    startTransition(async () => {
      const result = await updateUserGlobalRoles(userId, [...selected]);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("saveSuccess"));
    });
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("columnRoles")}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentRoles.length === 0 ? (
            <span className="text-sm text-muted-foreground">{t("noRoles")}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {currentRoles.map((role) => (
                <RoleNameBadge key={role.id} name={role.name} isSuperAdmin={role.isSuperAdmin} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("columnRoles")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {allRoles.map((role) => (
          <label key={role.id} className="flex items-center gap-2.5 text-sm">
            <Checkbox checked={selected.has(role.id)} onCheckedChange={() => toggle(role.id)} />
            {role.name}
          </label>
        ))}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(`error.${error}`)}
          </p>
        )}

        <Button size="sm" className="self-start" onClick={handleSave} disabled={isPending}>
          {t("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
