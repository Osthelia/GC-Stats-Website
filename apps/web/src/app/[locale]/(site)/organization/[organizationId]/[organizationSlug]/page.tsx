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
import {
  getOrganizationPageInfo,
  getOrganizationMembers,
  getOrganizationStreamChannels,
  getOrganizationVods,
  getOrganizationNews,
} from "@/lib/organization-page-data";
import { OrganizationHeader } from "@/components/organization/organization-header";
import { OrganizationMembers } from "@/components/organization/organization-members";
import { OrganizationStreamsPanel } from "@/components/organization/organization-streams-panel";
import { OrganizationVodsPanel } from "@/components/organization/organization-vods-panel";
import { PressPanel } from "@/components/press/press-panel";
import type { AppLocale } from "@/i18n/routing";
import type { Metadata } from "next";
import { organizationPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { locale, organizationId } = await params;
  return organizationPageMetadata(locale, organizationId);
}

// `/organization/{id}/{slug}` — two separate path segments, like team/player/
// tournament (see lib/entity-id.ts). `organizationSlug` itself is never read
// back (cosmetic only, never validated), only re-derived from the real name
// so in-page links stay well-formed even from a stale shared URL.
export default async function OrganizationPage({ params }: { params: Promise<{ locale: string; organizationId: string; organizationSlug: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const organization = await getOrganizationPageInfo(id);
  if (!organization) notFound();

  const basePath = `${organization.id}/${organization.slug}`;

  const [members, streams, vods, articles, t] = await Promise.all([
    getOrganizationMembers(id),
    getOrganizationStreamChannels(id),
    getOrganizationVods(id),
    getOrganizationNews(id, organization.name, locale as AppLocale),
    getTranslations("organizationPage"),
  ]);

  return (
    <div>
      <OrganizationHeader organization={organization} segment={basePath} activeTab="overview" memberCount={members.current.length} />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-7 pb-[70px]">
        <div className="grid grid-cols-1 gap-7 md:grid-cols-3">
          <OrganizationStreamsPanel channels={streams} />
          <OrganizationVodsPanel vods={vods} />
          <PressPanel items={articles} title={t("news")} emptyLabel={t("noNews")} langNote={t("newsLangNote")} />
        </div>

        <OrganizationMembers current={members.current} formers={members.formers} />
      </div>
    </div>
  );
}
