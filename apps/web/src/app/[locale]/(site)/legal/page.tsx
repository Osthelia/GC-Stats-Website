/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useLocale, useTranslations } from "next-intl";
import { LegalPageHeader, SectionCard, SectionText, Callout, icons } from "@/components/legal/ui";
import { Link } from "@/i18n/navigation";
import { formatLastUpdated } from "@/lib/format-date";

export default function LegalNoticePage() {
  const t = useTranslations("legalNotice");
  const lastUpdated = formatLastUpdated(useLocale());

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} lastUpdated={t("lastUpdated", { date: lastUpdated })} />

      <div className="space-y-5 pt-6">
        <SectionCard icon={icons.id} title={t("editor.title")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-neutral-500">{t("editor.identity")}</p>
              <p className="mt-0.5 text-sm font-medium text-neutral-50">Osthelia</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">{t("editor.status")}</p>
              <p className="mt-0.5 text-sm font-medium text-neutral-50">{t("editor.statusValue")}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">{t("editor.email")}</p>
              <p className="mt-0.5 text-sm font-medium text-neutral-50 underline decoration-[#e4ae22] decoration-2 underline-offset-2">contact@gc-stats.app</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">{t("editor.director")}</p>
              <p className="mt-0.5 text-sm font-medium text-neutral-50">Alice Alleman</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={icons.shield} title={t("property.title")}>
          <SectionText>{t("property.mainText")}</SectionText>
          <div className="space-y-3 rounded-xl bg-black/25 p-5">
            <h3 className="text-sm font-semibold text-neutral-50">{t("property.noteTitle")}</h3>
            <p className="text-[13px] leading-relaxed text-neutral-400">{t("property.noteBody")}</p>
            <p className="text-[13px] font-medium text-neutral-300">{t("property.disclaimer")}</p>
            <Link
              href="/takedown"
              className="inline-flex items-center rounded-lg bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition hover:bg-[#c9981d]"
            >
              {t("property.takedownBtn")}
            </Link>
          </div>
        </SectionCard>

        <SectionCard icon={icons.database} title={t("dataUsage.title")}>
          <SectionText>{t("dataUsage.mainText")}</SectionText>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border-t-2 border-[#e4ae22] bg-black/25 p-4">
              <p className="mb-1.5 text-xs font-semibold text-neutral-300">{t("dataUsage.allowedTitle")}</p>
              <p className="text-[13px] leading-relaxed text-neutral-500">{t("dataUsage.allowedText")}</p>
            </div>
            <div className="rounded-xl border-t-2 border-red-500/70 bg-black/25 p-4">
              <p className="mb-1.5 text-xs font-semibold text-red-400">{t("dataUsage.forbiddenTitle")}</p>
              <p className="text-[13px] leading-relaxed text-neutral-500">{t("dataUsage.forbiddenText")}</p>
            </div>
          </div>
          <p className="text-xs italic text-neutral-600">{t("dataUsage.attributionNotice")}</p>
        </SectionCard>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SectionCard icon={icons.server} title={t("hosting.title")}>
            <div className="space-y-3 text-[13px] text-neutral-400">
              <p>
                <span className="block text-xs font-medium text-neutral-500">{t("hosting.name")}</span>
                Cloudflare, Inc. (Workers), 101 Townsend St, San Francisco, CA 94107, USA
              </p>
              <p>
                <span className="block text-xs font-medium text-neutral-500">{t("hosting.nameSecondary")}</span>
                Infomaniak Network SA (Public Cloud), Rue Eugène-Marziano 25, 1227 Les Acacias (GE), Switzerland
              </p>
              <p>
                <span className="block text-xs font-medium text-neutral-500">{t("hosting.cdnTitle")}</span>
                {t("hosting.cdnValue")}
              </p>
              <p>
                <span className="block text-xs font-medium text-neutral-500">{t("hosting.mailTitle")}</span>
                {t("hosting.mailValue")}
              </p>
            </div>
          </SectionCard>

          <SectionCard icon={icons.shield} title={t("gdpr.title")}>
            <div className="space-y-3 text-[13px] text-neutral-400">
              <p>{t("gdpr.intro")}</p>
              <p>
                <span className="block text-xs font-medium text-neutral-500">{t("gdpr.contact")}</span>
                board@osthelia.org
              </p>
            </div>
          </SectionCard>
        </div>

        <SectionCard icon={icons.cookie} title={t("cookies.title")}>
          <SectionText>{t("cookies.text")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.heart} title={t("credits.title")}>
          <p className="text-sm leading-relaxed text-neutral-400">
            {t.rich("credits.emotes", {
              link: (chunks) => (
                <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener noreferrer" className="text-neutral-50 underline decoration-[#e4ae22] decoration-2 underline-offset-2 transition-colors hover:text-[#e4ae22]">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
