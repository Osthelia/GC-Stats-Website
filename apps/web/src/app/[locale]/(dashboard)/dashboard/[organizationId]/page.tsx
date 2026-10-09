/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Building2, Users, UsersRound, Clapperboard, KeyRound, ShieldCheck, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireDashboardOrgAccess } from "@/lib/dashboard-rbac";
import { getAdminOrganization } from "@/lib/admin-organizations";
import { getOrganizationAccessCount } from "@/lib/organization-access-data";
import { getEntityLogos, themedLogoUrls } from "@/lib/admin-logos";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgLogoTile } from "@/components/dashboard/org-logo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { organizationId } = await params;
  const id = parseEntityId(organizationId);
  const organization = id === null ? null : await getAdminOrganization(id);
  return { title: organization?.name ?? "Dashboard" };
}

export default async function DashboardOrganizationPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  const organization = await getAdminOrganization(id);
  if (!organization) notFound();

  const t = await getTranslations({ locale, namespace: "dashboard.overview" });
  const tRole = await getTranslations({ locale, namespace: "admin.organizations.edit.role" });
  const [accessCount, logos] = await Promise.all([getOrganizationAccessCount(id), getEntityLogos("organization", id)]);
  const logoUrls = themedLogoUrls(logos, "organization");

  const quickLinks = [
    ...(membership.isTeamLinked ? [] : [{ href: `/dashboard/${id}/profile`, icon: Building2, labelKey: "goProfile" as const }]),
    { href: `/dashboard/${id}/members`, icon: UsersRound, labelKey: "goRoster" },
    ...(membership.isTeamLinked ? [] : [{ href: `/dashboard/${id}/credits`, icon: Clapperboard, labelKey: "goCredits" as const }]),
    { href: `/dashboard/${id}/access`, icon: Users, labelKey: "goMembers" },
    ...(membership.isOwner ? [{ href: `/dashboard/${id}/permissions`, icon: KeyRound, labelKey: "goPermissions" as const }] : []),
  ];

  const roleLabel = membership.isGlobalAdminOverride ? tRole("admin") : membership.isOwner ? tRole("owner") : membership.roleName;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <OrgLogoTile name={organization.name} logoUrl={logoUrls.light} darkLogoUrl={logoUrls.dark} className="size-11 rounded-xl text-lg" />
        <div>
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
          <p className="text-sm text-muted-foreground">{t("title")}</p>
        </div>
      </div>

      {membership.isGlobalAdminOverride && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="size-4 shrink-0" />
          <span>{t("adminOverrideNotice")}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-primary/20">
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="size-8 shrink-0 text-primary" />
            <div>
              <p className="text-2xl font-bold">{accessCount}</p>
              <p className="text-xs text-muted-foreground">{t("statMembers")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-400/30">
          <CardContent className="flex items-center gap-3 py-4">
            <ShieldCheck className="size-8 shrink-0 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{roleLabel}</p>
              <p className="text-xs text-muted-foreground">{t("statRole")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <KeyRound className="size-8 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{membership.permissions.size}</p>
              <p className="text-xs text-muted-foreground">{t("statPermissions")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("quickLinksTitle")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <link.icon className="size-5 text-primary" />
              <span className="text-sm font-medium">{t(link.labelKey)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
