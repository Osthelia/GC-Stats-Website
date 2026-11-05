/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { ArrowLeftRight, Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { staticTitleMetadata } from "@/lib/page-metadata";
import { LiquipediaTournamentSearch } from "@/components/liquipedia/liquipedia-tournament-search";

export const generateMetadata = staticTitleMetadata("liquipediaHub.title");

export default function LiquipediaPage() {
  const t = useTranslations("liquipediaHub");

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-[28px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
      <p className="mt-2 text-[14.5px] text-neutral-400">{t("subtitle")}</p>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-neutral-800 p-5" style={{ background: "var(--gcs-surface-3)" }}>
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e4ae22]/15 text-[#e4ae22]">
            <Trophy className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black text-neutral-100">{t("tournamentsTitle")}</span>
            <span className="mt-0.5 block text-xs text-neutral-500">{t("tournamentsHint")}</span>
          </span>
        </div>
        <LiquipediaTournamentSearch />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/liquipedia/transfers"
          className="group flex items-center gap-4 rounded-2xl border border-neutral-800 px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#e4ae22]/50 active:scale-[0.98]"
          style={{ background: "var(--gcs-surface-3)" }}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e4ae22]/15 text-[#e4ae22]">
            <ArrowLeftRight className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black text-neutral-100 group-hover:text-[#e4ae22]">{t("transfersTitle")}</span>
            <span className="mt-0.5 block text-xs text-neutral-500">{t("transfersHint")}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
