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
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";

/** Link shared without its slug: send it to the canonical URL. */
export default async function TournamentIdRedirectPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const id = parseEntityId((await params).tournamentId);
  if (id === null) notFound();

  const tournament = await getPublicTournamentHeader(id);
  if (!tournament) notFound();

  redirect({
    href: `/tournaments/${tournament.id}/${slugify(tournament.name)}`,
    locale: await getLocale(),
  });
}
