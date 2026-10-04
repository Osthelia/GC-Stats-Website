/**
 * GC-Stats - activity-log-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AdminActivityLogRow } from "@/lib/admin-activity-log";
import { FormattedDate } from "@/components/formatted-date";

const EVENT_STYLES: Record<string, string> = {
  created: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  updated: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  deleted: "border-destructive/20 bg-destructive/10 text-destructive",
};

function EventBadge({ event }: { event: string | null }) {
  const t = useTranslations("admin.activityLog");
  if (!event) return <span className="text-sm text-muted-foreground">–</span>;
  return <Badge variant="outline" className={cn(EVENT_STYLES[event] ?? "border-border bg-muted text-muted-foreground")}>{t.has(`event.${event}`) ? t(`event.${event}`) : event}</Badge>;
}

function actorUserIdOf(row: AdminActivityLogRow): string | null {
  if (row.properties === null || typeof row.properties !== "object") return null;
  const actorUserId = (row.properties as Record<string, unknown>).actorUserId;
  return typeof actorUserId === "string" ? actorUserId : null;
}

function hasDetails(row: AdminActivityLogRow): boolean {
  const hasProps = row.properties !== null && (typeof row.properties !== "object" || Object.keys(row.properties as object).length > 0);
  const hasChanges = row.attributeChanges !== null && (typeof row.attributeChanges !== "object" || Object.keys(row.attributeChanges as object).length > 0);
  return hasProps || hasChanges;
}

export function ActivityLogPanel({ rows }: { rows: AdminActivityLogRow[] }) {
  const t = useTranslations("admin.activityLog");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
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
            const expandable = hasDetails(row);
            const isOpen = expanded.has(row.id);
            return (
              <Fragment key={row.id}>
                <TableRow className={cn(expandable && "cursor-pointer")} onClick={() => expandable && toggle(row.id)}>
                  <TableCell>
                    {expandable && (isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />)}
                  </TableCell>
                  <TableCell className="max-w-96">
                    <p className="truncate text-sm" title={row.description}>
                      {row.description}
                    </p>
                    {row.logName && <span className="text-xs text-muted-foreground">{row.logName}</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.subjectType ? `${row.subjectType} #${row.subjectId}` : "–"}</TableCell>
                  <TableCell>
                    <EventBadge event={row.event} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.causerType ? (
                      <span className="flex items-center gap-1.5">
                        {`${row.causerType} #${row.causerId}`}
                        {actorUserIdOf(row) && (
                          <Link href={`/admin/users/${actorUserIdOf(row)}`} className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                            {t("viewCauser")}
                          </Link>
                        )}
                      </span>
                    ) : (
                      t("systemCauser")
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground"><FormattedDate date={row.createdAt} mode="datetime" /></TableCell>
                </TableRow>
                {expandable && isOpen && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={5}>
                      <div className="flex flex-col gap-2 py-1">
                        {row.attributeChanges != null && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">{t("attributeChanges")}</p>
                            <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-background p-2 text-xs">{JSON.stringify(row.attributeChanges, null, 2)}</pre>
                          </div>
                        )}
                        {row.properties != null && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">{t("properties")}</p>
                            <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-background p-2 text-xs">{JSON.stringify(row.properties, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
