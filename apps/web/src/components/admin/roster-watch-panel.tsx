/**
 * GC-Stats - roster-watch-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, ExternalLink, EyeOff, ImageOff, Loader2, Pencil, Play, XCircle } from "lucide-react";
import { getPathname, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminEntityLogo } from "@/components/admin/admin-entity-logo";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { FormattedDate } from "@/components/formatted-date";
import { reviewRosterSignal } from "@/actions/admin-roster-watch";
import { REVIEW_NOTE_MAX_LENGTH, REVIEW_TOPICS } from "@/lib/roster-watch/constants";
import { cn } from "@/lib/utils";
import type { RosterWatchRow, RosterWatchTab, SortDirection } from "@/lib/admin-roster-watch";
import type { AppLocale } from "@/i18n/routing";
import type { ReviewInput } from "@/lib/roster-watch/review";

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
  tab,
  canManage,
  sortable,
}: {
  rows: RosterWatchRow[];
  tab: RosterWatchTab;
  canManage: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.rosterWatch");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notRoster, setNotRoster] = useState<RosterWatchRow | null>(null);
  const [reviewTopic, setReviewTopic] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [errors, setErrors] = useState<{ reviewTopic?: string; reviewNote?: string }>({});

  const topicItems = Object.fromEntries(REVIEW_TOPICS.map((value) => [value, t(`topic.${value}`)]));

  function submit(row: RosterWatchRow, input: ReviewInput) {
    setBusyId(row.id);
    startTransition(async () => {
      const result = await reviewRosterSignal(row.id, input);
      setBusyId(null);
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: t(`error.${result.error}`) });
        else toast.error(t(`error.${result.error}`));
        return;
      }
      closeDialog();
      toast.success(t(`reviewed.${result.status}`));
      router.refresh();
    });
  }

  function closeDialog() {
    setNotRoster(null);
    setReviewTopic("");
    setReviewNote("");
    setErrors({});
  }

  function editTeam(row: RosterWatchRow) {
    window.open(getPathname({ href: `/admin/teams/${row.teamId}`, locale }), "_blank", "noopener");
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTh pathname={sortable.pathname} col="team" label={t("columnTeam")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead>{t("columnTweet")}</TableHead>
              <TableHead>{t("columnType")}</TableHead>
              <AdminSortableTh pathname={sortable.pathname} col="tweetedAt" label={t("columnDate")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead className="text-right">{t("columnActions")}</TableHead>
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
            {rows.map((row) => {
              const pending = row.status === "pending";
              const busy = isPending && busyId === row.id;
              return (
                <TableRow key={row.id} className="align-top">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AdminEntityLogo src={row.teamLogoUrl} alt={row.teamName} sizeClassName="size-7" />
                      <span className="font-medium">{row.teamName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xl whitespace-normal">
                    <p className="whitespace-pre-wrap break-words text-sm">{row.text || t("card.noText")}</p>
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
                    {!pending ? (
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={cn(STATUS_STYLES[row.status])}>
                          {t(`reviewed.${row.status}`)}
                        </Badge>
                        {row.reviewedByUsername && <span className="text-xs text-muted-foreground">{row.reviewedByUsername}</span>}
                        {row.reviewTopic && <span className="text-xs text-muted-foreground">{t(`topic.${row.reviewTopic}`)}</span>}
                        {row.reviewNote && <span className="max-w-56 whitespace-pre-wrap text-xs text-muted-foreground">{row.reviewNote}</span>}
                      </div>
                    ) : (
                      canManage && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => editTeam(row)}>
                            <Pencil />
                            {t("actions.editTeam")}
                          </Button>
                          <Button size="sm" disabled={isPending} onClick={() => submit(row, { action: "team_edited" })}>
                            {busy ? <Loader2 className="animate-spin" /> : <Check />}
                            {t("actions.done")}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => submit(row, { action: "ignored" })}>
                            <EyeOff />
                            {t("actions.ignore")}
                          </Button>
                          {tab === "unsure" && (
                            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setNotRoster(row)}>
                              <XCircle />
                              {t("actions.notRoster")}
                            </Button>
                          )}
                        </div>
                      )
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!notRoster} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("actions.notRoster")}</DialogTitle>
            <DialogDescription>{notRoster?.teamName}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("form.topic")} <span className="text-destructive">*</span>
              </Label>
              <Select items={topicItems} value={reviewTopic || null} onValueChange={(v) => setReviewTopic(v ?? "")}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.reviewTopic}>
                  <SelectValue placeholder={t("form.topicPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {REVIEW_TOPICS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`topic.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reviewTopic && <p className="text-xs text-destructive">{errors.reviewTopic}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                {t("form.noteWhatIsIt")} <span className="text-destructive">*</span>
              </Label>
              <Textarea value={reviewNote} maxLength={REVIEW_NOTE_MAX_LENGTH} aria-invalid={!!errors.reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
              {errors.reviewNote && <p className="text-xs text-destructive">{errors.reviewNote}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
              {t("form.cancel")}
            </Button>
            <Button type="button" disabled={isPending} onClick={() => notRoster && submit(notRoster, { action: "marked_not_roster", reviewTopic, reviewNote })}>
              {isPending && <Loader2 className="animate-spin" />}
              {t("form.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
