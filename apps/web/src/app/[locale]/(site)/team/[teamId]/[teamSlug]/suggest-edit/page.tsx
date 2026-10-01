/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { db } from "@gc-stats/db/client";
import { teams } from "@gc-stats/db";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getTeamPageInfo, getTeamRoster, getTeamNameHistory } from "@/lib/team-page-data";
import { getEntityLogos } from "@/lib/admin-logos";
import { getCurrentUserId } from "@/lib/session";
import { SuggestEditForm } from "@/components/change-request/suggest-edit-form";
import type { MembershipEntryView } from "@/components/change-request/membership-history-section";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "suggestEdit" });
  return { title: t("title") };
}

export default async function TeamSuggestEditPage({ params }: { params: Promise<{ locale: string; teamId: string; teamSlug: string }> }) {
  const { locale, teamId } = await params;
  setRequestLocale(locale as AppLocale);

  const id = parseEntityId(teamId);
  if (id === null) notFound();

  const team = await getTeamPageInfo(id);
  if (!team) notFound();

  const basePath = `${team.id}/${slugify(team.name)}`;

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: { pathname: "/login", query: { callbackUrl: `/team/${basePath}/suggest-edit` } }, locale: locale as AppLocale });
    return null;
  }

  const [t, logos, roster, nameHistory, [rawTeam]] = await Promise.all([
    getTranslations({ locale: locale as AppLocale, namespace: "suggestEdit" }),
    getEntityLogos("team", id),
    getTeamRoster(id, { photos: false }),
    getTeamNameHistory(id),
    db.select({ isActive: teams.isActive }).from(teams).where(eq(teams.id, id)).limit(1),
  ]);

  const membershipEntries: MembershipEntryView[] = [
    ...roster.current.map((m) => ({
      membershipId: m.membershipId,
      displayName: m.handle,
      countryCode: m.countryCode,
      secondaryCountryCode: m.secondaryCountryCode,
      role: m.role,
      since: m.since,
      until: null,
      inactiveSince: m.inactiveSince,
      isCurrent: true,
    })),
    ...roster.formers.map((m) => ({
      membershipId: m.membershipId,
      displayName: m.handle,
      countryCode: null,
      secondaryCountryCode: null,
      role: m.role,
      since: m.since,
      until: m.until,
      inactiveSince: m.inactiveSince,
      isCurrent: false,
    })),
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-14 pb-28">
      <div className="mb-8">
        <h1 className="mb-2 text-[28px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
        <p className="text-[14.5px] text-neutral-400">{t("subtitle")}</p>
      </div>
      <SuggestEditForm
        subjectType="team"
        subjectId={team.id}
        entity={{ ...team, isActive: rawTeam?.isActive ?? true }}
        backHref={`/team/${basePath}`}
        entityName={team.name}
        logos={logos}
        membershipEntries={membershipEntries}
        nameHistory={nameHistory}
      />
    </div>
  );
}
