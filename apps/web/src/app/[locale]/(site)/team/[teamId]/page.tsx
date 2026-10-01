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
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getTeamPageInfo } from "@/lib/team-page-data";

/** Link shared without its slug: send it to the canonical URL. */
export default async function TeamIdRedirectPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const id = parseEntityId((await params).teamId);
  if (id === null) notFound();

  const team = await getTeamPageInfo(id);
  if (!team) notFound();

  redirect({
    href: `/team/${team.id}/${slugify(team.name)}`,
    locale: await getLocale(),
  });
}
