/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, SmallCard, ChannelCard, icons } from "@/components/legal/ui";
import { Link } from "@/i18n/navigation";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("supportUs.title");

export default function SupportUsPage() {
  const t = useTranslations("supportUs");

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} lastUpdated={t("subtitle")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <div className="space-y-5 pt-6">
        <SectionCard icon={icons.info} title={t("osthelia.title")}>
          <SectionText>{t("osthelia.body")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.users} title={t("values.title")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SmallCard title={t("values.inclusion.title")}>{t("values.inclusion.body")}</SmallCard>
            <SmallCard title={t("values.ethics.title")}>{t("values.ethics.body")}</SmallCard>
            <SmallCard title={t("values.equity.title")}>{t("values.equity.body")}</SmallCard>
          </div>
        </SectionCard>

        <SectionCard icon={icons.scale} title={t("funds.title")}>
          <SectionText>{t("funds.body")}</SectionText>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/finance"
              className="inline-flex items-center rounded-lg bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition hover:bg-[#c9981d]"
            >
              {t("funds.linkFinance")}
            </Link>
            <Link
              href="/transparency"
              className="inline-flex items-center rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-4 py-2 text-[13px] font-semibold text-neutral-200 transition hover:border-[#e4ae22]/60"
            >
              {t("funds.linkTransparency")}
            </Link>
          </div>
        </SectionCard>

        <SectionCard icon={icons.coffee} title={t("donate.title")}>
          <SectionText>{t("donate.body")}</SectionText>
          <a
            href="https://ko-fi.com/gcstats"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition hover:bg-[#c9981d]"
          >
            {icons.coffee}
            {t("donate.cta")}
          </a>
        </SectionCard>

        <SectionCard icon={icons.mail} title={t("contact.title")}>
          <SectionText>{t("contact.body")}</SectionText>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ChannelCard icon={icons.mail} title={t("contact.email")} value="contact@osthelia.org" href="mailto:contact@osthelia.org" />
            <ChannelCard icon={icons.globe} title={t("contact.x")} value="x.com/Osthelia" href="https://x.com/Osthelia" />
            <ChannelCard icon={icons.link} title={t("contact.website")} value="osthelia.org" href="https://osthelia.org" />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
