/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useLocale, useTranslations } from "next-intl";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, Callout, SmallCard, InfoBar, icons } from "@/components/legal/ui";
import { Link } from "@/i18n/navigation";
import { formatLastUpdated } from "@/lib/format-date";

export default function PrivacyPage() {
  const t = useTranslations("privacy");
  const lastUpdated = formatLastUpdated(useLocale());

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} lastUpdated={t("lastUpdated", { date: lastUpdated })} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <div className="space-y-5 pt-6">
        <SectionCard icon={icons.chart} title={t("analytics.title")}>
          <SectionText>{t("analytics.text")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.database} title={t("publicData.title")}>
          <SectionText>{t("publicData.text")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.shield} title={t("privateData.title")}>
          <SectionText>{t("privateData.text")}</SectionText>
          <Callout>{t("privateData.discordUsage")}</Callout>
          <Callout>{t("privateData.riotUsage")}</Callout>
        </SectionCard>

        <SectionCard icon={icons.id} title={t("accountData.title")}>
          <SectionText>{t("accountData.text")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.link} title={t("socialLogin.title")}>
          <SectionText>{t("socialLogin.text")}</SectionText>
          <Callout>{t("socialLogin.gravatar")}</Callout>
        </SectionCard>

        <SectionCard icon={icons.gavel} title={t("moderation.title")}>
          <SectionText>{t("moderation.text")}</SectionText>
          <Callout>{t("moderation.retentionNote")}</Callout>
        </SectionCard>

        <SectionCard icon={icons.layers} title={t("dataStructure.title")}>
          <SectionText>{t("dataStructure.text")}</SectionText>
          <Link
            href="/data"
            className="inline-flex items-center rounded-lg bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition hover:bg-[#c9981d]"
          >
            {t("dataStructure.button")}
          </Link>
        </SectionCard>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SmallCard title={t("retention.title")}>{t("retention.text")}</SmallCard>
          <SmallCard title={t("rights.title")}>
            <p className="mb-3">{t("rights.text")}</p>
            <p className="inline-block border border-white/5 bg-[var(--gcs-surface-2)] p-2 text-[10px] font-bold uppercase text-neutral-50">{t("rights.contact")}</p>
          </SmallCard>
        </div>

        <SectionCard icon={icons.cookie} title={t("cookies.title")}>
          <SectionText>{t("cookies.text")}</SectionText>
        </SectionCard>

        <InfoBar>
          <Link href="/takedown" className="font-medium text-neutral-300 underline decoration-[#e4ae22] decoration-2 underline-offset-2 hover:text-neutral-50">
            {t("takedownLink")}
          </Link>
        </InfoBar>
      </div>
    </div>
  );
}
