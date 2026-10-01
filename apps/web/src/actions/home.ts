/**
 * GC-Stats - home
 *
 * Server action paginating the home page's upcoming match days list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { getHomeMatchDays, type HomeMatchDaysPage } from "@/lib/home-data";
import { routing, type AppLocale } from "@/i18n/routing";

const EMPTY_PAGE: HomeMatchDaysPage = { days: [], nextOffset: 0, hasMore: false };

export async function loadMoreHomeMatches(pastOffset: number, locale: AppLocale): Promise<HomeMatchDaysPage> {
  if (!Number.isInteger(pastOffset) || pastOffset < 0) return EMPTY_PAGE;
  if (!routing.locales.includes(locale)) return EMPTY_PAGE;
  return getHomeMatchDays(locale, pastOffset);
}
