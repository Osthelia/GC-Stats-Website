/**
 * GC-Stats - role-permissions-form
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
import { PERMISSION_GROUPS } from "@gc-stats/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateRolePermissions } from "@/actions/admin-roles";

/** "teams.edit" -> "teams_edit", to key into admin.roles.permissionNames (i18n keys can't contain dots — they're read as nesting). */
function permissionKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

export function RolePermissionsForm({
  roleId,
  isSuperAdmin,
  initialPermissions,
}: {
  roleId: number;
  isSuperAdmin: boolean;
  initialPermissions: string[];
}) {
  const t = useTranslations("admin.roles");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialPermissions));
  const [isPending, startTransition] = useTransition();

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateRolePermissions(roleId, [...selected]);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("saveSuccess"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionPermissions")}</CardTitle>
        {isSuperAdmin && <CardDescription>{t("protectedRoleHint")}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(`permissionGroups.${group.key}`)}
            </h3>
            <div className="flex flex-col gap-1.5">
              {group.permissions.map((name) => (
                <label key={name} className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={isSuperAdmin || selected.has(name)}
                    disabled={isSuperAdmin}
                    onCheckedChange={() => toggle(name)}
                  />
                  {t(`permissionNames.${permissionKey(name)}`)}
                </label>
              ))}
            </div>
          </div>
        ))}

        {!isSuperAdmin && (
          <div>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
