/**
 * GC-Stats - load-messages
 *
 * Loads a locale's messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { AbstractIntlMessages } from "next-intl";
import type { AppLocale } from "./routing";

export async function loadMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  return (await import(`../messages/${locale}.json`)).default;
}
