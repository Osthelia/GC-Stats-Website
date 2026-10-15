/**
 * GC-Stats - page
 *
 * The admin root opens the dashboard of the game the staff member worked on last.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { redirect } from "@/i18n/navigation";
import { getPreferredGame } from "@/lib/game";

export default async function AdminRootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: `/admin/${await getPreferredGame()}`, locale });
}
