/**
 * GC-Stats - roster-watch-panel
 *
 * History table of the reviewed tweets, the pending ones are handled by the deck.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, ImageOff, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminEntityLogo } from "@/components/admin/admin-entity-logo";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { FormattedDate } from "@/components/formatted-date";
import { cn } from "@/lib/utils";
import type { RosterWatchRow, SortDirection } from "@/lib/admin-roster-watch";

const VERDICT_STYLES = {
  roster: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  unsure: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  not_roster: "border-border bg-muted text-muted-foreground",
} as const;

const STATUS_STYLES: Record<string, string> = {
  team_edited: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  ignored: "border-border bg-muted text-muted-foreground",
  marked_not_roster: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  reported_missed: "border-amber-400/20 bg-amber-400/10 text-amber-300",
};

function MediaThumb({ media, label }: { media: RosterWatchRow["media"][number]; label: string }) {
  const [failed, setFailed] = useState(false);
  const preview = media.type === "photo" ? media.url : media.previewUrl;

  return (
    <a href={media.url} target="_blank" rel="noopener noreferrer" aria-label={label} className="relative block size-14 overflow-hidden rounded-md border bg-muted transition-all hover:opacity-80 active:scale-95">
      {preview && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-4" />
        </div>
      )}
      {media.type === "video" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
          <Play className="size-4" />
        </span>
      )}
    </a>
  );
}

export function RosterWatchPanel({
  rows,
  sortable,
}: {
  rows: RosterWatchRow[];
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.rosterWatch");

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <AdminSortableTh pathname={sortable.pathname} col="team" label={t("columnTeam")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
            <TableHead>{t("columnTweet")}</TableHead>
            <TableHead>{t("columnType")}</TableHead>
            <AdminSortableTh pathname={sortable.pathname} col="tweetedAt" label={t("columnDate")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
            <TableHead className="text-right">{t("columnReview")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id} className="align-top">
              <TableCell>
                <div className="flex items-center gap-2">
                  <AdminEntityLogo src={row.teamLogoUrl} alt={row.teamName} sizeClassName="size-7" />
                  <span className="font-medium">{row.teamName}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-xl whitespace-normal">
                <p className="whitespace-pre-wrap break-words text-sm">{row.textEn || row.text || t("card.noText")}</p>
                {row.media.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.media.map((media) => (
                      <MediaThumb key={media.url} media={media} label={t(media.type === "photo" ? "card.openPhoto" : "card.openVideo")} />
                    ))}
                  </div>
                )}
                {row.llmReason && <p className="mt-2 text-xs text-muted-foreground">{row.llmReason}</p>}
                <a href={row.tweetUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground active:opacity-70">
                  <ExternalLink className="size-3.5" />
                  {t("card.openTweet")}
                </a>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col items-start gap-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {row.verdict && (
                      <Badge variant="outline" className={cn(VERDICT_STYLES[row.verdict])}>
                        {t(`verdict.${row.verdict}`)}
                      </Badge>
                    )}
                    {row.topic && <Badge variant="outline">{t(`topic.${row.topic}`)}</Badge>}
                  </div>
                  {row.players.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t("card.players")} {row.players.join(", ")}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <FormattedDate date={row.tweetedAt} mode="datetime" />
              </TableCell>
              <TableCell className="text-right whitespace-normal">
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={cn(STATUS_STYLES[row.status])}>
                    {t(`reviewed.${row.status}`)}
                  </Badge>
                  {row.reviewedByUsername && <span className="text-xs text-muted-foreground">{row.reviewedByUsername}</span>}
                  {row.reviewTopic && <span className="text-xs text-muted-foreground">{t(`topic.${row.reviewTopic}`)}</span>}
                  {row.reviewNote && <span className="max-w-56 whitespace-pre-wrap text-xs text-muted-foreground">{row.reviewNote}</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
