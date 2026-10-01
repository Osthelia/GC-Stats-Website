/**
 * GC-Stats - user-organizations-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AdminUserOrganizationRow } from "@/lib/admin-user-detail";

export async function UserOrganizationsPanel({ organizations }: { organizations: AdminUserOrganizationRow[] }) {
  const t = await getTranslations("admin.users.organizationsPanel");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {organizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {organizations.map((org) => (
              <Link key={org.id} href={`/admin/organizations/${org.id}`} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0 hover:bg-muted/50">
                <span className="truncate font-medium">{org.name}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {org.isOwner ? (
                    <Badge variant="outline">{t("owner")}</Badge>
                  ) : org.roleNames.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t("noRole")}</span>
                  ) : (
                    org.roleNames.map((name) => (
                      <Badge key={name} variant="outline">
                        {name}
                      </Badge>
                    ))
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
