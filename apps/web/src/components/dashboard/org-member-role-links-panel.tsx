/**
 * GC-Stats - org-member-role-links-panel
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORGANIZATION_MEMBER_ROLES } from "@/lib/organization-roles";
import { setOrganizationMemberRoleLink } from "@/actions/dashboard-organizations";
import type { OrganizationMemberRoleLink } from "@/lib/organization-roles-data";
import type { OrganizationRoleSummary } from "@/lib/organization-roles-data";

const NONE = "none";
const OWNER = "owner";

function linkValue(link: OrganizationMemberRoleLink | undefined): string {
  if (!link) return NONE;
  return link.permissionRoleId === null ? OWNER : String(link.permissionRoleId);
}

/**
 * Opt-in config panel: for each public roster role, an organization owner
 * can pick a dashboard access role to auto-grant when someone with a linked
 * account gets that member role, see organization_member_role_links'
 * schema comment. Owner-only, same gate as the rest of /dashboard/{id}/permissions.
 */
export function OrgMemberRoleLinksPanel({ organizationId, roles, initialLinks }: { organizationId: number; roles: OrganizationRoleSummary[]; initialLinks: OrganizationMemberRoleLink[] }) {
  const t = useTranslations("admin.organizations.edit");
  const tDash = useTranslations("dashboard.permissions");
  const [links, setLinks] = useState(initialLinks);
  const [isPending, startTransition] = useTransition();

  function handleChange(memberRole: string, value: string) {
    const target = value === NONE ? "none" : value === OWNER ? "owner" : Number(value);
    startTransition(async () => {
      const result = await setOrganizationMemberRoleLink(organizationId, memberRole, target);
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.invalid"));
        return;
      }
      setLinks((prev) => {
        const rest = prev.filter((l) => l.memberRole !== memberRole);
        if (target === "none") return rest;
        return [...rest, { memberRole, permissionRoleId: target === "owner" ? null : target }];
      });
      toast.success(tDash("memberRoleLinkSaved"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tDash("memberRoleLinksTitle")}</CardTitle>
        <CardDescription>{tDash("memberRoleLinksHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORGANIZATION_MEMBER_ROLES.map((memberRole) => {
            const value = linkValue(links.find((l) => l.memberRole === memberRole));
            const items: Record<string, string> = { [NONE]: tDash("memberRoleLinkNone"), [OWNER]: t("role.owner") };
            for (const role of roles) items[String(role.id)] = role.name;
            return (
              <div key={memberRole} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t(`role.${memberRole}` as "role.owner")}</span>
                <Select
                  items={items}
                  value={value}
                  onValueChange={(v) => v && handleChange(memberRole, v)}
                  disabled={isPending}
                >
                  <SelectTrigger aria-label={t(`role.${memberRole}` as "role.owner")} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{tDash("memberRoleLinkNone")}</SelectItem>
                    <SelectItem value={OWNER}>{t("role.owner")}</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={String(role.id)}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
