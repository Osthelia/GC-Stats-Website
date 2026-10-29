/**
 * GC-Stats - opendata-cell
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CountryBadge } from "@/components/team/country-badge";
import { FormattedDate } from "@/components/formatted-date";
import type { OpenDataColumnMeta, OpenDataRow } from "@/lib/opendata/datasets-meta";

const EMPTY = <span className="text-neutral-600">-</span>;

const STATUS_STYLE: Record<string, string> = {
  live: "bg-red-500/15 text-red-400",
  upcoming: "bg-sky-500/15 text-sky-400",
  pending: "bg-sky-500/15 text-sky-400",
  finished: "bg-neutral-500/15 text-neutral-400",
  completed: "bg-neutral-500/15 text-neutral-400",
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold ${className}`}>{children}</span>;
}

/** Renders one value of the explorer according to its column type. */
export function OpenDataCell({ column, row }: { column: OpenDataColumnMeta; row: OpenDataRow }) {
  const t = useTranslations("openData");
  const value = row[column.key];
  if (value === null || value === undefined || value === "") return EMPTY;

  const linkId = column.link ? row[column.link.linkIdKey ?? column.key] : null;
  const wrapLink = (content: React.ReactNode) =>
    column.link && linkId != null ? (
      <Link href={`${column.link.path}/${linkId}`} className="text-neutral-100 underline-offset-4 transition-colors hover:text-[#e4ae22] hover:underline active:opacity-70">
        {content}
      </Link>
    ) : (
      content
    );

  switch (column.type) {
    case "id":
      return wrapLink(<span className="font-mono text-[12px] tabular-nums">{String(value)}</span>);
    case "number":
      return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
    case "date":
      return <FormattedDate date={`${value}T00:00:00Z`} />;
    case "datetime":
      return <FormattedDate date={String(value)} mode="datetime" />;
    case "boolean":
      return value ? <Pill className="bg-emerald-500/15 text-emerald-400">{t("yes")}</Pill> : <Pill className="bg-neutral-500/15 text-neutral-400">{t("no")}</Pill>;
    case "country":
      return (
        <span className="inline-flex items-center gap-1.5">
          <CountryBadge code={String(value)} size={16} />
          <span className="font-mono text-[12px]">{String(value)}</span>
        </span>
      );
    case "url":
      return isHttpUrl(String(value)) ? (
        <a href={String(value)} target="_blank" rel="noopener noreferrer nofollow" className="text-sky-400 underline-offset-4 transition-colors hover:underline active:opacity-70">
          {t("openLink")}
        </a>
      ) : (
        String(value)
      );
    case "socials": {
      const entries = Object.entries(value as Record<string, string>).filter(([, v]) => !!v);
      if (entries.length === 0) return EMPTY;
      return (
        <span className="flex flex-wrap gap-1">
          {entries.map(([platform, link]) =>
            isHttpUrl(link) ? (
              <a
                key={platform}
                href={link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="rounded-md border border-neutral-700 px-1.5 py-0.5 text-[11px] text-neutral-300 transition-colors hover:border-[#e4ae22]/60 hover:text-neutral-50 active:opacity-70"
              >
                {platform}
              </a>
            ) : (
              <span key={platform} title={link} className="rounded-md border border-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-500">
                {platform}
              </span>
            ),
          )}
        </span>
      );
    }
    case "matchStatus":
    case "tournamentStatus":
      return <Pill className={STATUS_STYLE[String(value)] ?? "bg-neutral-500/15 text-neutral-400"}>{t.has(`status.${value}`) ? t(`status.${value}` as never) : String(value)}</Pill>;
    case "longText":
      return (
        <span className="block max-w-[320px] truncate" title={String(value)}>
          {String(value)}
        </span>
      );
    default:
      return wrapLink(
        <span className="block max-w-[260px] truncate" title={String(value)}>
          {String(value)}
        </span>,
      );
  }
}
