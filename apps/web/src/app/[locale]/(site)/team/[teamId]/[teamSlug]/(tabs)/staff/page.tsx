/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parseEntityId } from "@/lib/entity-id";
import { getTeamPageInfo, getTeamStaff } from "@/lib/team-page-data";
import { OrganizationMembers } from "@/components/organization/organization-members";
import type { Metadata } from "next";
import { teamPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; teamId: string }> }): Promise<Metadata> {
  const { locale, teamId } = await params;
  return teamPageMetadata(locale, teamId, "tabStaff");
}

export default async function TeamStaffPage({ params }: { params: Promise<{ teamId: string; teamSlug: string }> }) {
  const { teamId } = await params;
  const id = parseEntityId(teamId);
  if (id === null) notFound();

  const team = await getTeamPageInfo(id);
  if (!team || team.organizationId === null) notFound();

  const [staff, t] = await Promise.all([getTeamStaff(team.organizationId), getTranslations("teamPage")]);

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-7 pb-[70px]">
      <OrganizationMembers current={staff.current} formers={staff.formers} labels={{ title: t("staffTitle", { team: team.name }), empty: t("noStaff"), formers: t("formerStaff") }} />
    </div>
  );
}
