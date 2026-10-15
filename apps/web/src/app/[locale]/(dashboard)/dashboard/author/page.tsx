/**
 * GC-Stats - page
 *
 * A writer's articles exist per game: open the game the writer worked on last.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { redirect } from "@/i18n/navigation";
import { getPreferredGame } from "@/lib/game";

export default async function DashboardAuthorRootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: `/dashboard/author/${await getPreferredGame()}`, locale });
}
