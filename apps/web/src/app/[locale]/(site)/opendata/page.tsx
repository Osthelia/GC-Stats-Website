/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import type { ComponentType } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowRight, FileText, ListOrdered, Map as MapIcon, Shield, Swords, Trophy, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LegalIntro, LegalPageHeader, SectionCard, SectionList, Callout, icons } from "@/components/legal/ui";
import { OpenDataAccessNotice } from "@/components/opendata/opendata-access-notice";
import { OpenDataDownloadButton } from "@/components/opendata/opendata-download-button";
import { staticTitleMetadata } from "@/lib/page-metadata";
import { getOpenDataAccess } from "@/lib/opendata/access";
import { getOpenDataCounts } from "@/lib/opendata/handler";
import { OPENDATA_DATASETS, OPENDATA_DATASET_META, OPENDATA_MAX_FILTERS, OPENDATA_PAGE_SIZES, type OpenDataDataset } from "@/lib/opendata/datasets-meta";
export const dynamic = "force-dynamic";
export const generateMetadata = staticTitleMetadata("openData.title");
const DATASET_ICONS: Record<OpenDataDataset, ComponentType<{ className?: string }>> = {
  tournaments: Trophy,
  teams: Shield,
  players: User,
  matches: Swords,
  maps: MapIcon,
  map_players: ListOrdered,
};
function Code({ children }: { children: string }) {
  return <code className="block overflow-x-auto rounded-lg border border-neutral-800 bg-black/30 px-3 py-2 font-mono text-[12.5px] text-neutral-200">{children}</code>;
}
export default async function OpenDataPage() {
  const t = await getTranslations("openData");
  const { config, blocked } = await getOpenDataAccess();
  const counts = blocked === "disabled" ? null : await getOpenDataCounts();
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-16">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("subtitle")}</LegalIntro>
      {blocked && <OpenDataAccessNotice reason={blocked} callbackPath="/opendata" />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {OPENDATA_DATASETS.map((dataset) => {
          const Icon = DATASET_ICONS[dataset];
          const count = counts?.[dataset];
          return (
            <div key={dataset} className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)] text-[#e4ae22]">
                  <Icon className="size-5" />
                </span>
                <span className="rounded-full border border-neutral-800 px-2.5 py-0.5 text-xs text-neutral-400 tabular-nums">
                  {count != null ? t("rowCount", { count }) : "-"}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <h2 className="text-lg font-semibold tracking-tight text-neutral-50">{t(`datasets.${dataset}.name`)}</h2>
                <p className="text-sm leading-relaxed text-neutral-400">{t(`datasets.${dataset}.description`)}</p>
                <p className="text-xs text-neutral-500">{t("columnCount", { count: OPENDATA_DATASET_META[dataset].columns.length })}</p>
              </div>
              {!blocked && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/opendata/${dataset}`}
                    className="inline-flex items-center gap-2 rounded-[9px] bg-[#e4ae22] px-3.5 py-2 text-[13px] font-semibold text-[#0e0e0e] transition-all hover:bg-[#f0bc33] active:scale-[0.97]"
                  >
                    {t("explore")}
                    <ArrowRight className="size-4" />
                  </Link>
                  <OpenDataDownloadButton dataset={dataset} variant="secondary" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SectionCard icon={icons.scale} title={t("usage.title")}>
        <SectionList
          items={[
            t("usage.publicOnly"),
            t("usage.terms"),
            t("usage.freshness"),
            t("usage.limits", { browse: config.browsePerMinute, exports: config.exportsPerHour }),
            ...(config.requireAccount ? [t("usage.accountOnly")] : []),
          ]}
        />
        <Callout>{t("usage.priority")}</Callout>
        <Link
          href="/terms"
          className="inline-flex w-fit items-center gap-2 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2 text-[13px] font-semibold text-neutral-200 transition-all hover:bg-[var(--gcs-hover)] active:scale-[0.97]"
        >
          <FileText className="size-4" />
          {t("usage.termsLink")}
        </Link>
      </SectionCard>
      <SectionCard icon={icons.code} title={t("api.title")}>
        <p className="text-sm leading-relaxed text-neutral-400">{t("api.intro")}</p>
        <Code>{"GET /api/opendata/{dataset}?page=1&per_page=50&sort=name&direction=asc&q=...&f.{column}=..."}</Code>
        <Code>{"GET /api/opendata/{dataset}/export?q=...&f.{column}=..."}</Code>
        <SectionList
          items={[
            t("api.datasets", { list: OPENDATA_DATASETS.join(", ") }),
            t("api.paramPerPage", { sizes: OPENDATA_PAGE_SIZES.join(", ") }),
            t("api.paramSort"),
            t("api.paramQ"),
            t("api.paramFilter", { max: OPENDATA_MAX_FILTERS }),
            t("api.errors"),
          ]}
        />
      </SectionCard>
    </div>
  );
}
