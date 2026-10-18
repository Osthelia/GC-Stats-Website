/**
 * GC-Stats - page
 *
 * The site root has no content of its own: it opens the game the visitor
 * browsed last.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { redirect } from "@/i18n/navigation";
import { getPreferredGame } from "@/lib/game";

export default async function RootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: `/${await getPreferredGame()}`, locale });
}
