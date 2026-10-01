/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useLocale, useTranslations } from "next-intl";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, SectionList, Callout, SmallCard, InfoBar, icons } from "@/components/legal/ui";
import { formatLastUpdated } from "@/lib/format-date";

export default function TermsPage() {
  const t = useTranslations("terms");
  const lastUpdated = formatLastUpdated(useLocale());

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} lastUpdated={t("lastUpdated", { date: lastUpdated })} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <div className="space-y-5 pt-6">
        <SectionCard icon={icons.info} title={t("service.title")}>
          <SectionText>{t("service.text")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.key} title={t("access.title")}>
          <SectionText>{t("access.text")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.database} title={t("riotData.title")}>
          <SectionText>{t("riotData.text")}</SectionText>
          <SectionList items={t.raw("riotData.items") as string[]} />
          <Callout>{t("riotData.optIn")}</Callout>
          <Callout>{t("riotData.correction")}</Callout>
        </SectionCard>

        <SectionCard icon={icons.ban} title={t("prohibited.title")}>
          <SectionText>{t("prohibited.text")}</SectionText>
          <SectionList items={t.raw("prohibited.items") as string[]} />
        </SectionCard>

        <SectionCard icon={icons.code} title={t("api.title")}>
          <SectionText>{t("api.text")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.gavel} title={t("ip.title")}>
          <SectionText>{t("ip.text")}</SectionText>
        </SectionCard>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SmallCard title={t("liability.title")}>{t("liability.text")}</SmallCard>
          <SmallCard title={t("changes.title")}>{t("changes.text")}</SmallCard>
        </div>

        <SmallCard title={t("contact.title")}>
          <p className="mb-3">{t("contact.text")}</p>
          <p className="inline-block border border-white/5 bg-[var(--gcs-surface-2)] p-2 text-[10px] font-bold uppercase text-neutral-50">{t("contact.email")}</p>
        </SmallCard>

        <InfoBar>{t("riotNotice")}</InfoBar>
      </div>
    </div>
  );
}
