/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, icons } from "@/components/legal/ui";
import { Link } from "@/i18n/navigation";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("transparency.title");

function ProviderCard({ icon, name, role, body }: { icon: React.ReactNode; name: string; role: string; body: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] text-[#e4ae22]">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-neutral-50">{name}</p>
          <p className="text-[11px] font-medium text-neutral-500">{role}</p>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-400">{body}</p>
    </div>
  );
}

export default function TransparencyPage() {
  const t = useTranslations("transparency");

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} lastUpdated={t("subtitle")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <div className="space-y-5 pt-6">
        <SectionCard icon={icons.code} title={t("dev.title")}>
          <SectionText>{t("dev.body")}</SectionText>
          <SectionText>{t("dev.body2")}</SectionText>
          <a
            href="https://github.com/GC-Stats/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition hover:bg-[#c9981d]"
          >
            {t("dev.link")}
          </a>
        </SectionCard>

        <SectionCard icon={icons.server} title={t("hosting.title")}>
          <SectionText>{t("hosting.body")}</SectionText>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ProviderCard icon={icons.server} name={t("hosting.cloudflareHosting.name")} role={t("hosting.cloudflareHosting.role")} body={t("hosting.cloudflareHosting.body")} />
            <ProviderCard icon={icons.globe} name={t("hosting.cdn.name")} role={t("hosting.cdn.role")} body={t("hosting.cdn.body")} />
          </div>

          <div className="space-y-4 rounded-xl border border-[#e4ae22]/25 bg-black/25 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] text-[#e4ae22]">{icons.database}</span>
              <div>
                <p className="text-sm font-semibold text-neutral-50">{t("hosting.infomaniak.name")}</p>
                <p className="text-[11px] font-medium text-neutral-500">{t("hosting.infomaniak.role")}</p>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">{t("hosting.infomaniak.intro")}</p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-[var(--gcs-surface-2)] p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-300">{t("hosting.infomaniak.cloud.title")}</p>
                <p className="text-[12px] leading-relaxed text-neutral-500">{t("hosting.infomaniak.cloud.body")}</p>
              </div>
              <div className="rounded-lg bg-[var(--gcs-surface-2)] p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-300">{t("hosting.infomaniak.publicCloud.title")}</p>
                <p className="text-[12px] leading-relaxed text-neutral-500">{t("hosting.infomaniak.publicCloud.body")}</p>
              </div>
              <div className="rounded-lg bg-[var(--gcs-surface-2)] p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-300">{t("hosting.infomaniak.database.title")}</p>
                <p className="text-[12px] leading-relaxed text-neutral-500">{t("hosting.infomaniak.database.body")}</p>
              </div>
              <div className="rounded-lg bg-[var(--gcs-surface-2)] p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-300">{t("hosting.infomaniak.mail.title")}</p>
                <p className="text-[12px] leading-relaxed text-neutral-500">{t("hosting.infomaniak.mail.body")}</p>
              </div>
              <div className="rounded-lg bg-[var(--gcs-surface-2)] p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-300">{t("hosting.infomaniak.domain.title")}</p>
                <p className="text-[12px] leading-relaxed text-neutral-500">{t("hosting.infomaniak.domain.body")}</p>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 text-[#e4ae22]">
                {icons.heart}
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("hosting.infomaniak.quote.cite")}</span>
              </div>
              <blockquote className="space-y-2.5 border-l-2 border-[#e4ae22]/40 pl-4">
                <p className="text-[13px] italic leading-relaxed text-neutral-400">{t("hosting.infomaniak.quote.p1")}</p>
                <p className="text-[13px] italic leading-relaxed text-neutral-400">{t("hosting.infomaniak.quote.p2")}</p>
                <p className="text-[13px] italic leading-relaxed text-neutral-400">{t("hosting.infomaniak.quote.p3")}</p>
                <p className="text-[13px] italic leading-relaxed text-neutral-400">{t("hosting.infomaniak.quote.p4")}</p>
              </blockquote>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={icons.database} title={t("data.title")}>
          <SectionText>{t("data.body")}</SectionText>
          <Link
            href="/data"
            className="inline-flex items-center rounded-lg bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition hover:bg-[#c9981d]"
          >
            {t("data.link")}
          </Link>
        </SectionCard>

        <SectionCard icon={icons.chart} title={t("finance.title")}>
          <SectionText>{t("finance.body")}</SectionText>
          <Link
            href="/finance"
            className="inline-flex items-center rounded-lg bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition hover:bg-[#c9981d]"
          >
            {t("finance.link")}
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}
