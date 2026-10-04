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
import { people } from "@gc-stats/db";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPlayerPageInfo, getPlayerTeamHistory } from "@/lib/player-page-data";
import { getEntityLogos } from "@/lib/admin-logos";
import { getCurrentUserId } from "@/lib/session";
import { getUserLinkStatus } from "@/lib/user-link-request";
import { SuggestEditForm } from "@/components/change-request/suggest-edit-form";
import type { MembershipEntryView } from "@/components/change-request/membership-history-section";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "suggestEdit" });
  return { title: t("title") };
}

export default async function PlayerSuggestEditPage({ params }: { params: Promise<{ locale: string; playerId: string; playerSlug: string }> }) {
  const { locale, playerId } = await params;
  setRequestLocale(locale as AppLocale);

  const id = parseEntityId(playerId);
  if (id === null) notFound();

  const player = await getPlayerPageInfo(id);
  if (!player) notFound();

  const basePath = `${player.id}/${slugify(player.handle)}`;

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect({ href: { pathname: "/login", query: { callbackUrl: `/player/${basePath}/suggest-edit` } }, locale: locale as AppLocale });
    return null;
  }

  const [t, logos, teamHistory, [rawPerson], linkStatus] = await Promise.all([
    getTranslations({ locale: locale as AppLocale, namespace: "suggestEdit" }),
    getEntityLogos("person", id),
    getPlayerTeamHistory(id),
    db.select({ pronouns: people.pronouns, aliases: people.aliases, isActive: people.isActive }).from(people).where(eq(people.id, id)).limit(1),
    getUserLinkStatus(userId, id),
  ]);

  const previousPersonId = linkStatus.state === "available" ? linkStatus.previousPersonId : null;
  const [previousPerson] = previousPersonId
    ? await db.select({ handle: people.handle }).from(people).where(eq(people.id, previousPersonId)).limit(1)
    : [];

  const membershipEntries: MembershipEntryView[] = [
    ...teamHistory.current.map((h) => ({
      membershipId: h.membershipId,
      displayName: h.teamName,
      countryCode: h.teamCountryCode,
      secondaryCountryCode: h.teamSecondaryCountryCode,
      role: h.role,
      since: h.since,
      until: null,
      inactiveSince: h.inactiveSince,
      isCurrent: true,
    })),
    ...teamHistory.formers.map((h) => ({
      membershipId: h.membershipId,
      displayName: h.teamName,
      countryCode: h.teamCountryCode,
      secondaryCountryCode: h.teamSecondaryCountryCode,
      role: h.role,
      since: h.since,
      until: h.until,
      inactiveSince: h.inactiveSince,
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
        subjectType="person"
        subjectId={player.id}
        entity={{ ...player, ...rawPerson }}
        backHref={`/player/${basePath}`}
        entityName={player.handle}
        logos={logos}
        membershipEntries={membershipEntries}
        userLink={{ state: linkStatus.state, previousHandle: previousPerson?.handle ?? null }}
      />
    </div>
  );
}
