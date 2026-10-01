/**
 * GC-Stats - routing
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { defineRouting } from "next-intl/routing";

// Add a locale by adding its entry here plus a messages/<locale>.json file.
export const routing = defineRouting({
  locales: ["fr", "en", "es", "pt", "tr", "ja", "ko", "de", "zh", "it", "pl", "ar", "th"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export const localeDisplay: Record<AppLocale, { flag: string; name: string; code: string }> = {
  fr: { flag: "🇫🇷", name: "Français", code: "FR" },
  en: { flag: "🇬🇧", name: "English", code: "EN" },
  es: { flag: "🇪🇸", name: "Español", code: "ES" },
  pt: { flag: "🇧🇷", name: "Português", code: "PT" },
  tr: { flag: "🇹🇷", name: "Türkçe", code: "TR" },
  ja: { flag: "🇯🇵", name: "日本語", code: "JA" },
  ko: { flag: "🇰🇷", name: "한국어", code: "KO" },
  de: { flag: "🇩🇪", name: "Deutsch", code: "DE" },
  zh: { flag: "🇨🇳", name: "简体中文", code: "ZH" },
  it: { flag: "🇮🇹", name: "Italiano", code: "IT" },
  pl: { flag: "🇵🇱", name: "Polski", code: "PL" },
  ar: { flag: "🇸🇦", name: "العربية", code: "AR" },
  th: { flag: "🇹🇭", name: "ไทย", code: "TH" },
};

// Locales written right to left, the root layout sets <html dir> from this.
export const rtlLocales: readonly AppLocale[] = ["ar"];
