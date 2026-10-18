/**
 * GC-Stats - page
 *
 * An author's articles exist per game: open the game the staff member worked on last.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { redirect } from "@/i18n/navigation";
import { getPreferredGame } from "@/lib/game";

export default async function DashboardAuthorRootPage({ params }: { params: Promise<{ locale: string; authorId: string }> }) {
  const { locale, authorId } = await params;
  redirect({ href: `/dashboard/authors/${authorId}/${await getPreferredGame()}`, locale });
}
