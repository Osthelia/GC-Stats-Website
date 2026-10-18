/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { parseEntityId } from "@/lib/entity-id";
import { redirectIfOrganizationLinked } from "@/lib/organization-team-link";
import { getOrganizationPageInfo } from "@/lib/organization-page-data";
import { gameFromParams } from "@/lib/game";

/** Link shared without its slug: send it to the canonical URL. */
export default async function OrganizationIdRedirectPage({
  params,
}: {
  params: Promise<{ organizationId: string; game: string }>;
}) {
  const game = await gameFromParams(params);
  const id = parseEntityId((await params).organizationId);
  if (id === null) notFound();

  const organization = await getOrganizationPageInfo(id);
  if (!organization) notFound();

  const locale = await getLocale();
  await redirectIfOrganizationLinked(game, id, locale);
  redirect({
    href: `/${game}/organization/${organization.id}/${organization.slug}`,
    locale,
  });
}
