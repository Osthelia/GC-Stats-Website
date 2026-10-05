/**
 * GC-Stats - load-messages
 *
 * Loads a locale's messages. Aliased to load-messages.cloudflare.ts on the
 * Cloudflare build (see next.config.mjs) to keep translations out of the
 * Worker bundle.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { AbstractIntlMessages } from "next-intl";
import type { AppLocale } from "./routing";

export async function loadMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  return (await import(`../messages/${locale}.json`)).default;
}
