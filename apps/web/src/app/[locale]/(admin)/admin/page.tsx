/**
 * GC-Stats - page
 *
 * The admin root opens the dashboard of the game the staff member worked on last.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { redirect } from "@/i18n/navigation";
import { getPreferredGame } from "@/lib/game";
import { listAdminGames, requireAdminAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

/** The dashboard of the game the viewer browsed last, when they can administer it; else of the first game they can. */
export default async function AdminRootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const access = await requireAdminAccess(locale as AppLocale);
  const [games, preferred] = await Promise.all([listAdminGames(access.userId), getPreferredGame()]);
  redirect({ href: `/admin/${games.includes(preferred) ? preferred : (games[0] ?? preferred)}`, locale });
}
