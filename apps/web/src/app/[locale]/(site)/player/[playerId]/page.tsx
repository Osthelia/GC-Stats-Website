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
import { getPlayerHandle } from "@/lib/player-page-data";

/** Link shared without its slug: send it to the canonical URL. */
export default async function PlayerIdRedirectPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const id = parseEntityId((await params).playerId);
  if (id === null) notFound();

  const handle = await getPlayerHandle(id);
  if (handle === null) notFound();

  redirect({
    href: `/player/${id}/${slugify(handle)}`,
    locale: await getLocale(),
  });
}
