/**
 * GC-Stats - render
 *
 * Resolves the translated texts, values and pictures of each bot alert in the subscription's locale.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { createTranslator } from "next-intl";
import { loadMessages } from "@/i18n/load-messages";
import { routing, type AppLocale } from "@/i18n/routing";
import { GCS_SITE_URL } from "./shared";
import { buildAlertFields, buildAlertImages, type AlertKind, type AlertMap, type AlertMatch, type Translate } from "./variables";

export type { AlertKind, AlertMap, AlertMatch, AlertMvp, AlertVeto } from "./variables";

/** Accent color per alert kind, plus the template background, already resolved from the alert and server overrides. */
export type AlertColors = Record<AlertKind, string> & { background: string };

function resolveLocale(locale: string): AppLocale {
  return (routing.locales as readonly string[]).includes(locale) ? (locale as AppLocale) : routing.defaultLocale;
}

async function getTranslator(locale: string): Promise<{ t: Translate; locale: AppLocale }> {
  const resolved = resolveLocale(locale);
  // Loosely typed: the messages are loaded for an arbitrary locale, outside the typed request config.
  const t = createTranslator({ locale: resolved, messages: await loadMessages(resolved), namespace: "discordBotMessages" }) as unknown as Translate;
  return { t, locale: resolved };
}

/** Pictures a template can show, by image source. Null when there is none (the renderer draws a fallback). */
export function resolveAlertImages(kind: AlertKind, match: AlertMatch, map?: AlertMap): Record<string, string | null> {
  return buildAlertImages(kind, match, map, GCS_SITE_URL);
}

/** Texts and raw values of an alert, translated in the subscription's locale. */
export async function resolveAlertFields(kind: AlertKind, match: AlertMatch, locale: string, map?: AlertMap): Promise<Record<string, string>> {
  const { t } = await getTranslator(locale);
  return buildAlertFields(kind, match, t, map);
}

/** Notice replacing an alert image removed by moderation, in the subscription's locale (English when the locale has no translation yet). */
export async function resolveImageRemovedNotice(locale: string): Promise<string> {
  const resolved = resolveLocale(locale);
  const read = async (l: AppLocale) => ((await loadMessages(l)).discordBotMessages as Record<string, string> | undefined)?.imageRemoved;
  return (await read(resolved)) ?? (await read("en")) ?? "";
}

/** Label of the button opening the match, in the subscription's locale. */
export async function resolveMatchButtonLabel(locale: string): Promise<string> {
  return (await getTranslator(locale)).t("openMatch");
}
