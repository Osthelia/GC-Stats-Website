/**
 * GC-Stats - org-activity-log-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Fragment, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormattedDate } from "@/components/formatted-date";
import { cn } from "@/lib/utils";
import type { OrgActivityLogRow } from "@/lib/organization-activity-log";

const EVENT_STYLES: Record<string, string> = {
  created: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  updated: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  deleted: "border-destructive/20 bg-destructive/10 text-destructive",
};

/** A Select item value can't be an empty string, so "no filter" is mapped to this and back. */
const ANY = "any";

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

type Option = { value: string; label: string };

function FilterSelect({ value, options, onChange, ariaLabel }: { value: string; options: Option[]; onChange: (value: string) => void; ariaLabel: string }) {
  const items = Object.fromEntries(options.map((o) => [o.value || ANY, o.label]));
  return (
    <Select items={items} value={value || ANY} onValueChange={(v) => onChange(v && v !== ANY ? v : "")}>
      <SelectTrigger aria-label={ariaLabel} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value || ANY}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OrgActivityLogPanel({
  rows,
  total,
  page,
  totalPages,
  q,
  subject,
  event,
  subjects,
  events,
}: {
  rows: OrgActivityLogRow[];
  total: number;
  page: number;
  totalPages: number;
  q: string;
  subject: string;
  event: string;
  subjects: string[];
  events: string[];
}) {
  const t = useTranslations("dashboard.logs");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function pushQuery(next: Record<string, string>) {
    const merged = { q, subject, event, page: "", ...next };
    const query = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== ""));
    startTransition(() => router.push({ pathname, query }));
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const subjectLabel = (value: string) => (t.has(`subject.${value}`) ? t(`subject.${value}`) : value);
  const eventLabel = (value: string) => (t.has(`event.${value}`) ? t(`event.${value}`) : value);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          pushQuery({ q: search.trim() });
        }}
      >
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="w-64" />
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {t("searchSubmit")}
        </Button>
        <FilterSelect value={subject} ariaLabel={t("subjectLabel")} onChange={(v) => pushQuery({ subject: v })} options={[{ value: "", label: t("subjectAny") }, ...subjects.map((v) => ({ value: v, label: subjectLabel(v) }))]} />
        <FilterSelect value={event} ariaLabel={t("eventLabel")} onChange={(v) => pushQuery({ event: v })} options={[{ value: "", label: t("eventAny") }, ...events.map((v) => ({ value: v, label: eventLabel(v) }))]} />
        {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t("loading")} />}
      </form>

      <div className={cn("overflow-x-auto rounded-md border transition-opacity", isPending && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>{t("columnDescription")}</TableHead>
              <TableHead>{t("columnSubject")}</TableHead>
              <TableHead>{t("columnEvent")}</TableHead>
              <TableHead>{t("columnCauser")}</TableHead>
              <TableHead>{t("columnCreatedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const changeEntries = row.changes ? Object.entries(row.changes) : [];
              const expandable = changeEntries.length > 0;
              const isOpen = expanded.has(row.id);
              return (
                <Fragment key={row.id}>
                  <TableRow className={cn(expandable && "cursor-pointer")} onClick={() => expandable && toggle(row.id)}>
                    <TableCell>{expandable && <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />}</TableCell>
                    <TableCell className="max-w-96">
                      <p className="truncate text-sm" title={row.description}>
                        {row.description}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.subjectType ? `${subjectLabel(row.subjectType)}${row.subjectId ? ` #${row.subjectId}` : ""}` : "-"}</TableCell>
                    <TableCell>
                      {row.event ? (
                        <Badge variant="outline" className={cn(EVENT_STYLES[row.event] ?? "border-border bg-muted text-muted-foreground")}>
                          {eventLabel(row.event)}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.actorUsername ?? t("systemCauser")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <FormattedDate date={row.createdAt} mode="datetime" />
                    </TableCell>
                  </TableRow>
                  {expandable && isOpen && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={5}>
                        <ul className="flex flex-col gap-1 py-1 text-xs">
                          {changeEntries.map(([field, change]) => (
                            <li key={field} className="break-all">
                              <span className="font-semibold">{field}</span>
                              <span className="text-muted-foreground">{": "}</span>
                              <span className="text-destructive">{formatValue(change.old)}</span>
                              <span className="text-muted-foreground">{" → "}</span>
                              <span className="text-emerald-400">{formatValue(change.new)}</span>
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">{t("total", { count: total })}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isPending} aria-label={t("previous")} onClick={() => pushQuery({ page: String(page - 1) })}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || isPending} aria-label={t("next")} onClick={() => pushQuery({ page: String(page + 1) })}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
