/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { Separator } from "@/components/ui/separator";
import { AboutSectionsPanel } from "@/components/admin/about-sections-panel";
import { AboutProjectsPanel } from "@/components/admin/about-projects-panel";
import { AboutTeamCategoriesPanel } from "@/components/admin/about-team-categories-panel";
import { AboutTeamMembersPanel } from "@/components/admin/about-team-members-panel";
import { listAboutSections, listAboutProjects } from "@/lib/admin-about";
import { listAboutTeamCategories, listAboutTeamMembersAdmin } from "@/lib/admin-about-team";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.about" });
  return { title: t("title") };
}

export default async function AdminAboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.aboutView);
  const t = await getTranslations({ locale, namespace: "admin.about" });

  const [sections, projects, teamCategories, teamMembers] = await Promise.all([
    listAboutSections(),
    listAboutProjects(),
    listAboutTeamCategories(),
    listAboutTeamMembersAdmin(),
  ]);
  const canManage = hasAccess(access, PERMISSIONS.aboutManage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AboutSectionsPanel sections={sections} canManage={canManage} />

      <Separator />

      <AboutProjectsPanel projects={projects} canManage={canManage} />

      <Separator />

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("team.heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("team.subtitle")}</p>
        </div>
        <AboutTeamCategoriesPanel categories={teamCategories} canManage={canManage} />
        <AboutTeamMembersPanel members={teamMembers} categories={teamCategories} canManage={canManage} />
      </div>
    </div>
  );
}
