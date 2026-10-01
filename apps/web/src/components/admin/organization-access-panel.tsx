/**
 * GC-Stats - organization-access-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ORGANIZATION_PERMISSION_GROUPS } from "@gc-stats/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateOrganizationMaxPermissions } from "@/actions/admin-organizations";

/** "organization.news.publish" -> "organization_news_publish", to key into admin.organizations.edit.accessPermissionNames (i18n keys can't contain dots — they're read as nesting). Mirrors RolePermissionsForm::permissionKey. */
function permissionKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

/**
 * The "access" side of the 2-level org edit (content vs. access): the
 * ceiling of `ORGANIZATION_PERMISSIONS` this organization's own future
 * role system (a /dashboard not built yet, see SUIVI.MD) could ever grant
 * its members — mirrors V1's Publisher max_permissions editor.
 */
export function OrganizationAccessPanel({ organizationId, initialMaxPermissions, canManage }: { organizationId: number; initialMaxPermissions: string[]; canManage: boolean }) {
  const t = useTranslations("admin.organizations.edit");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialMaxPermissions));
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
      const result = await updateOrganizationMaxPermissions(organizationId, [...selected]);
      if (!result.ok) {
        toast.error(t(`accessError.${result.error}`));
        return;
      }
      toast.success(t("saveSuccess"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionAccess")}</CardTitle>
        <CardDescription>{t("accessHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {ORGANIZATION_PERMISSION_GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(`accessPermissionGroups.${group.key}`)}</h3>
            <div className="flex flex-col gap-1.5">
              {group.permissions.map((name) => (
                <label key={name} className="flex items-center gap-2.5 text-sm">
                  <Checkbox checked={selected.has(name)} disabled={!canManage} onCheckedChange={() => toggle(name)} />
                  {t(`accessPermissionNames.${permissionKey(name)}`)}
                </label>
              ))}
            </div>
          </div>
        ))}

        {canManage && (
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
