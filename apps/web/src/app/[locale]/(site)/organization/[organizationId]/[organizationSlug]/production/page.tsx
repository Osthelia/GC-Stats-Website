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
} from "@/lib/organization-page-data";
import {
  getOrganizationProductionsPage,
  type OrganizationProductionSort,
} from "@/lib/production-credits-data";
import { parseProductionParams } from "@/lib/production-list-params";
import { OrganizationHeader } from "@/components/organization/organization-header";
import { ProductionSection } from "@/components/production/production-section";

const SORTS: readonly OrganizationProductionSort[] = ["tournament", "date"];

export default async function OrganizationProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; organizationSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const organization = await getOrganizationPageInfo(id);
  if (!organization) notFound();

  const basePath = `${organization.id}/${organization.slug}`;
  const pagePath = `/organization/${basePath}/production`;

  const sp = await searchParams;
  const parsed = parseProductionParams(sp, SORTS, "date");

  const [page, members, t] = await Promise.all([
    getOrganizationProductionsPage(id, parsed),
    getOrganizationMembers(id),
    getTranslations("organizationPage"),
  ]);
  const tProduction = await getTranslations("production");

  return (
    <div>
      <OrganizationHeader
        organization={organization}
        segment={basePath}
        activeTab="production"
        memberCount={members.current.length}
      />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-7 pb-[70px]">
        <h1 className="text-lg font-black tracking-tight text-neutral-50">
          {t("productionTitle", { organization: organization.name })}
        </h1>

        <ProductionSection
          page={page}
          parsed={parsed}
          pagePath={pagePath}
          eventSortKey="tournament"
          eventColumnLabel={tProduction("colTournament")}
          showPerson
          showOrganization={false}
        />
      </div>
    </div>
  );
}
