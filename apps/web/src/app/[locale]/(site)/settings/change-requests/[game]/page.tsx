/**
 * GC-Stats - page
 *
 * Links sent before the games existed point to /settings/change-requests/{id}:
 * a numeric segment is a Valorant request.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";

export default async function LegacyChangeRequestLinkPage({ params }: { params: Promise<{ locale: string; game: string }> }) {
  const { locale, game } = await params;
  if (!/^\d+$/.test(game)) notFound();
  redirect({ href: `/settings/change-requests/valorant/${game}`, locale });
}
