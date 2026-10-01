/**
 * GC-Stats - news-list-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormattedDate } from "@/components/formatted-date";
import type { DashboardNewsListRow } from "@/lib/dashboard-news-data";

type SortKey = "title" | "status" | "lang" | "updatedAt";

const ALL = "__all__";
const STATUS_FILTERS = ["draft", "in_review", "changes_requested", "approved", "published", "scheduled", "archived"] as const;

// Simple accent-insensitive substring match: this table's data is already
// loaded client-side (one organization's articles, never a large volume),
// no need for the typo-tolerant DB search used by admin's paginated lists.
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matchesStatusFilter(article: DashboardNewsListRow, filter: string): boolean {
  if (filter === ALL) return true;
  if (filter === "scheduled") return article.isScheduled;
  if (filter === "published") return article.status === "published" && !article.isScheduled;
  return article.status === filter;
}

export function NewsListTable({
  articles,
  listHref,
  canCreate,
  canEdit = true,
  showAuthorProfileLink = false,
  publicHref,
}: {
  articles: DashboardNewsListRow[];
  listHref: string;
  canCreate: boolean;
  /** false for a pure reviewer (organization.news.publish without .edit): the row opens the article read-only for review instead of editing, see NewsEditorForm's canEdit prop. */
  canEdit?: boolean;
  /** Org-scoped lists only: the byline profile lives outside this organization's own nav (see /dashboard/author/profile), so link out to it here rather than leaving it undiscoverable. */
  showAuthorProfileLink?: boolean;
  /** Public news listing this dashboard manages (organization or author profile), if the caller resolved one. */
  publicHref?: string;
}) {
  const t = useTranslations("dashboard.news");
  const tStatus = useTranslations("dashboard.news.status");
  const [sort, setSort] = useState<SortKey>("updatedAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [langFilter, setLangFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function toggleSort(key: SortKey) {
    if (sort === key) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection("asc");
    }
  }

  const langOptions = useMemo(() => [...new Set(articles.map((a) => a.lang))].sort(), [articles]);
  const hasActiveFilters = search.trim() !== "" || statusFilter !== ALL || langFilter !== ALL || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setSearch("");
    setStatusFilter(ALL);
    setLangFilter(ALL);
    setDateFrom("");
    setDateTo("");
  }

  const filtered = articles.filter((a) => {
    if (search.trim() && !normalize(a.title).includes(normalize(search.trim()))) return false;
    if (!matchesStatusFilter(a, statusFilter)) return false;
    if (langFilter !== ALL && a.lang !== langFilter) return false;
    if (dateFrom && a.updatedAt.toISOString().slice(0, 10) < dateFrom) return false;
    if (dateTo && a.updatedAt.toISOString().slice(0, 10) > dateTo) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sort === "title") cmp = a.title.localeCompare(b.title);
    else if (sort === "status") cmp = a.status.localeCompare(b.status);
    else if (sort === "lang") cmp = a.lang.localeCompare(b.lang);
    else cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
    return direction === "asc" ? cmp : -cmp;
  });

  function Th({ label, sortKey }: { label: string; sortKey: SortKey }) {
    return (
      <TableHead>
        <button type="button" onClick={() => toggleSort(sortKey)} className="flex items-center gap-1 font-medium hover:text-foreground">
          {label}
          {sort === sortKey && <span className="text-[10px]">{direction === "asc" ? "▲" : "▼"}</span>}
        </button>
      </TableHead>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-2">
          {publicHref && (
            <Button variant="outline" render={<Link href={publicHref} target="_blank" rel="noopener noreferrer" />}>
              <ExternalLinkIcon className="size-4" />
              {t("publicPageButton")}
            </Button>
          )}
          {showAuthorProfileLink && (
            <Button variant="outline" render={<Link href="/dashboard/author/profile" />}>
              {t("authorProfileLink")}
            </Button>
          )}
          {canCreate && <Button render={<Link href={`${listHref}/new`} />}>{t("createButton")}</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="w-full sm:w-56" />
        <Select items={{ [ALL]: t("filterStatusAll"), ...Object.fromEntries(STATUS_FILTERS.map((s) => [s, tStatus(s)])) }} value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filterStatusAll")}</SelectItem>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {tStatus(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={{ [ALL]: t("filterLangAll"), ...Object.fromEntries(langOptions.map((l) => [l, l.toUpperCase()])) }} value={langFilter} onValueChange={(v) => v && setLangFilter(v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filterLangAll")}</SelectItem>
            {langOptions.map((l) => (
              <SelectItem key={l} value={l} className="uppercase">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label={t("filterDateFrom")} className="w-full sm:w-auto" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label={t("filterDateTo")} className="w-full sm:w-auto" />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("filterClear")}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <Th label={t("columnTitle")} sortKey="title" />
              <Th label={t("columnStatus")} sortKey="status" />
              <Th label={t("columnLang")} sortKey="lang" />
              <Th label={t("columnUpdated")} sortKey="updatedAt" />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {articles.length === 0 ? t("empty") : t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {sorted.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">{article.title}</TableCell>
                <TableCell>
                  <Badge variant={article.status === "published" && !article.isScheduled ? "default" : article.status === "archived" ? "secondary" : "outline"}>
                    {article.isScheduled ? t("status.scheduled") : t(`status.${article.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs uppercase">{article.lang}</TableCell>
                <TableCell>
                  <FormattedDate date={article.updatedAt} mode="date" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      title={t("viewPublicButton")}
                      render={<Link href={`/news/${article.slug}`} target="_blank" rel="noopener noreferrer" />}
                    >
                      <ExternalLinkIcon className="size-4" />
                      <span className="sr-only">{t("viewPublicButton")}</span>
                    </Button>
                    <Button variant="outline" size="sm" render={<Link href={`${listHref}/${article.id}`} />}>
                      {canEdit ? t("editButton") : t("reviewButton")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
