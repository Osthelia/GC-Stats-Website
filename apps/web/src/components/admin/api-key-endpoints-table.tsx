/**
 * GC-Stats - api-key-endpoints-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Endpoint = { endpoint: string; requests: number; avgDurationMs: number; errorRatePercent: number };
type SortKey = "endpoint" | "requests" | "avgDurationMs" | "errorRatePercent";

/**
 * Mirrors components/dashboard/api-key-endpoints-table.tsx (kept separate per
 * CLAUDE.md admin/dashboard component split). All rows are already loaded
 * (one key's 30-day endpoint breakdown, a small set) — sorting is a plain
 * client-side re-sort, no server round-trip needed.
 */
export function ApiKeyEndpointsTable({ endpoints }: { endpoints: Endpoint[] }) {
  const t = useTranslations("admin.apiKeyStats");
  const [sort, setSort] = useState<SortKey>("requests");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...endpoints];
    copy.sort((a, b) => {
      const cmp = typeof a[sort] === "string" ? (a[sort] as string).localeCompare(b[sort] as string) : (a[sort] as number) - (b[sort] as number);
      return direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [endpoints, sort, direction]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDirection("desc");
    }
  }

  function Th({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const active = sort === sortKey;
    return (
      <TableHead>
        <button type="button" onClick={() => toggleSort(sortKey)} className={cn("flex cursor-pointer items-center gap-1 hover:text-foreground", active && "text-foreground")}>
          {label}
          {active && (direction === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />)}
        </button>
      </TableHead>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <Th label={t("columnEndpoint")} sortKey="endpoint" />
            <Th label={t("columnRequests")} sortKey="requests" />
            <Th label={t("columnAvgDuration")} sortKey="avgDurationMs" />
            <Th label={t("columnErrorRate")} sortKey="errorRatePercent" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                {t("endpointsEmpty")}
              </TableCell>
            </TableRow>
          )}
          {sorted.map((row) => (
            <TableRow key={row.endpoint}>
              <TableCell className="font-mono text-xs">{row.endpoint}</TableCell>
              <TableCell className="text-muted-foreground">{row.requests}</TableCell>
              <TableCell className="text-muted-foreground">{t("msValue", { value: row.avgDurationMs })}</TableCell>
              <TableCell className={cn(row.errorRatePercent > 0 ? "text-destructive" : "text-muted-foreground")}>{row.errorRatePercent}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
