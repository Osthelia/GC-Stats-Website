/**
 * GC-Stats - news-language-filter
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useSiteSettings } from "@/lib/site-settings";
import { cn } from "@/lib/utils";

/**
 * Multi-select toggle chips rather than ListFilterDropdown (that component
 * is single-select by design, doesn't fit "several languages at once":
 * news display isn't tied to the site's own language, a viewer picks any
 * set, defaulting to site locale + English). Local to the page it's used on
 * (URL-only, `?languages=`, `basePath` picks which page) — it seeds from the
 * global preference (header's settings panel, `useSiteSettings.newsLanguages`)
 * on arrival but never writes back to it, so browsing with a one-off language
 * set never changes what the home feed/team/player/org news widgets show
 * elsewhere.
 */
export function NewsLanguageFilter({ basePath, activeLanguages, options }: { basePath: string; activeLanguages: string[]; options: { code: string; name: string }[] }) {
  const t = useTranslations("newsPage.languageFilter");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { newsLanguages: storedPreference } = useSiteSettings();

  // If the URL has no explicit `languages` param but a global preference is
  // stored, apply it once on arrival — mirrors the anti-flash idea used for
  // theme, just resolved after hydration instead of before first paint.
  useEffect(() => {
    if (searchParams.get("languages")) return;
    if (!storedPreference || storedPreference.length === 0) return;
    const sameAsActive = storedPreference.length === activeLanguages.length && storedPreference.every((l) => activeLanguages.includes(l));
    if (sameAsActive) return;
    router.replace({ pathname: basePath, query: { ...Object.fromEntries(searchParams.entries()), languages: storedPreference.join(",") } }, { scroll: false });
    // Only meant to run once per mount (arrival), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(code: string) {
    const next = activeLanguages.includes(code) ? activeLanguages.filter((l) => l !== code) : [...activeLanguages, code];
    const effective = next.length === 0 ? [code] : next;

    const query: Record<string, string> = { ...Object.fromEntries(searchParams.entries()), languages: effective.join(",") };
    delete query.page;
    router.push({ pathname: basePath, query }, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[9px] font-black tracking-[0.3em] text-neutral-600 uppercase">{t("label")}</span>
      {options.map((option) => {
        const active = activeLanguages.includes(option.code);
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.code)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase transition-all hover:-translate-y-0.5",
              active ? "border-[#e4ae22]/50 bg-[#e4ae22]/10 text-[#e4ae22]" : "border-neutral-800 text-neutral-500 hover:border-neutral-700"
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
