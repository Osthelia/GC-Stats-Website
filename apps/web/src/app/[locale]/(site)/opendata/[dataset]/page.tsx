/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { OpenDataAccessNotice } from "@/components/opendata/opendata-access-notice";
import { OpenDataExplorer, type OpenDataExplorerInitialState } from "@/components/opendata/opendata-explorer";
import { getOpenDataAccess } from "@/lib/opendata/access";
import { parseBrowseQuery } from "@/lib/opendata/handler";
import { OPENDATA_DATASET_META, OPENDATA_DEFAULT_PAGE_SIZE, isOpenDataDataset } from "@/lib/opendata/datasets-meta";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; dataset: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, dataset } = await params;
  if (!isOpenDataDataset(dataset)) return {};
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "openData" });
  return { title: `${t(`datasets.${dataset}.name`)} · ${t("title")}` };
}

export default async function OpenDataDatasetPage({ params, searchParams }: { params: Params; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { dataset } = await params;
  if (!isOpenDataDataset(dataset)) notFound();

  const t = await getTranslations("openData");
  const { blocked } = await getOpenDataAccess();

  const raw = await searchParams;
  const urlParams = new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map((value) => [k, value])));
  const parsed = parseBrowseQuery(dataset, urlParams);
  const meta = OPENDATA_DATASET_META[dataset];
  const initial: OpenDataExplorerInitialState = parsed.ok
    ? { sort: parsed.query.sort, direction: parsed.query.direction, page: parsed.query.page, perPage: parsed.query.perPage, q: parsed.query.q, filters: parsed.query.filters.map((f) => ({ columnKey: f.column, value: f.value })) }
    : { sort: meta.defaultSort, direction: meta.defaultDirection, page: 1, perPage: OPENDATA_DEFAULT_PAGE_SIZE, q: "", filters: [] };

  return (
    <div className="mx-auto max-w-[clamp(1100px,88vw,2000px)] space-y-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/opendata" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase transition-colors hover:text-[#e4ae22] active:opacity-70">
          <ArrowLeft className="size-3.5" />
          {t("allDatasets")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-50">{t(`datasets.${dataset}.name`)}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">{t(`datasets.${dataset}.description`)}</p>
      </div>

      {blocked ? <OpenDataAccessNotice reason={blocked} callbackPath={`/opendata/${dataset}`} /> : <OpenDataExplorer dataset={dataset} initial={initial} />}
    </div>
  );
}
