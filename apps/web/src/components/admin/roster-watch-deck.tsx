/**
 * GC-Stats - roster-watch-deck
 *
 * Card by card review of the pending tweets: the tweet with its images on top,
 * big fixed action buttons below.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronsRight, ExternalLink, EyeOff, ImageOff, Languages, Loader2, Pencil, Play, RotateCcw, XCircle } from "lucide-react";
import { getPathname, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminEntityLogo } from "@/components/admin/admin-entity-logo";
import { FormattedDate } from "@/components/formatted-date";
import { reviewRosterSignal } from "@/actions/admin-roster-watch";
import { REVIEW_NOTE_MAX_LENGTH, REVIEW_TOPICS } from "@/lib/roster-watch/constants";
import { cn } from "@/lib/utils";
import type { RosterWatchRow } from "@/lib/admin-roster-watch";
import type { AppLocale } from "@/i18n/routing";
import type { ReviewInput } from "@/lib/roster-watch/review";

const BIG_BUTTON = "h-14 flex-1 gap-2 border border-neutral-700 bg-black px-4 text-base text-white transition-transform hover:bg-neutral-900 active:scale-95 active:bg-neutral-800";

function MediaBlock({ media, label }: { media: RosterWatchRow["media"][number]; label: string }) {
  const [failed, setFailed] = useState(false);
  const preview = media.type === "photo" ? media.url : media.previewUrl;

  return (
    <a href={media.url} target="_blank" rel="noopener noreferrer" aria-label={label} className="relative flex min-h-40 items-center justify-center overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90 active:opacity-70">
      {preview && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="max-h-[60vh] w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <ImageOff className="size-8 text-muted-foreground" />
      )}
      {media.type === "video" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
          <Play className="size-12" />
        </span>
      )}
    </a>
  );
}

export function RosterWatchDeck({ rows, canManage }: { rows: RosterWatchRow[]; canManage: boolean }) {
  const t = useTranslations("admin.rosterWatch");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [showOriginal, setShowOriginal] = useState(false);
  const [pickingTopic, setPickingTopic] = useState(false);
  const [reviewTopic, setReviewTopic] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const row = rows.find((candidate) => !skipped.has(candidate.id));
  const remaining = rows.filter((candidate) => !skipped.has(candidate.id)).length;

  function resetCard() {
    setPickingTopic(false);
    setReviewTopic(null);
    setShowOriginal(false);
    setNote("");
    setNoteError(null);
  }

  function next() {
    if (!row) return;
    setSkipped((previous) => new Set(previous).add(row.id));
    resetCard();
  }

  function submit(actionKey: string, input: ReviewInput) {
    if (!row) return;
    setBusyAction(actionKey);
    startTransition(async () => {
      const result = await reviewRosterSignal(row.id, input);
      setBusyAction(null);
      if (!result.ok) {
        if (result.field === "reviewNote") setNoteError(t(`error.${result.error}`));
        else toast.error(t(`error.${result.error}`));
        return;
      }
      resetCard();
      toast.success(t(`reviewed.${result.status}`));
      router.refresh();
    });
  }

  function editTeam() {
    if (row) window.open(getPathname({ href: `/admin/teams/${row.teamId}`, locale }), "_blank", "noopener");
  }

  if (!row) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border py-16 text-center">
        <p className="text-sm text-muted-foreground">{t(skipped.size > 0 ? "deck.allSeen" : "empty")}</p>
        {skipped.size > 0 && (
          <Button className={cn(BIG_BUTTON, "flex-none px-6")} onClick={() => setSkipped(new Set())}>
            <RotateCcw />
            {t("deck.restart")}
          </Button>
        )}
      </div>
    );
  }

  const hasTranslation = !!row.textEn && row.textEn !== row.text;
  const shownText = hasTranslation && !showOriginal ? row.textEn : row.text;

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AdminEntityLogo src={row.teamLogoUrl} alt={row.teamName} sizeClassName="size-10" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{row.teamName}</p>
              <p className="text-xs text-muted-foreground">
                <FormattedDate date={row.tweetedAt} mode="datetime" />
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{t("deck.remaining", { count: remaining })}</span>
        </div>

        <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{shownText || t("card.noText")}</p>

        {hasTranslation && (
          <button type="button" className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground active:opacity-70" onClick={() => setShowOriginal((value) => !value)}>
            <Languages className="size-3.5" />
            {t(showOriginal ? "deck.showTranslation" : "deck.showOriginal")}
          </button>
        )}

        {row.media.length > 0 && (
          <div className="flex flex-col gap-3">
            {row.media.map((media) => (
              <MediaBlock key={media.url} media={media} label={t(media.type === "photo" ? "card.openPhoto" : "card.openVideo")} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {row.topic && <Badge variant="outline">{t(`topic.${row.topic}`)}</Badge>}
          {row.players.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("card.players")} {row.players.join(", ")}
            </span>
          )}
        </div>
        {row.llmReason && <p className="text-sm text-muted-foreground">{row.llmReason}</p>}

        <a href={row.tweetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground transition-colors hover:text-foreground active:opacity-70">
          <ExternalLink className="size-3.5" />
          {t("card.openTweet")}
        </a>
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 border-t bg-background/95 px-1 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {pickingTopic && !reviewTopic ? (
            <>
              <p className="text-sm font-medium">{t("deck.pickTopic")}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {REVIEW_TOPICS.map((topic) => (
                  <Button key={topic} className={cn(BIG_BUTTON, "flex-none")} onClick={() => setReviewTopic(topic)}>
                    {t(`topic.${topic}`)}
                  </Button>
                ))}
              </div>
              <Button className={cn(BIG_BUTTON, "flex-none")} onClick={() => setPickingTopic(false)}>
                <ArrowLeft />
                {t("deck.back")}
              </Button>
            </>
          ) : pickingTopic && reviewTopic ? (
            <>
              <p className="text-sm font-medium">{t(`topic.${reviewTopic}`)}</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roster-watch-note">{t("deck.explanation")}</Label>
                <Textarea
                  id="roster-watch-note"
                  value={note}
                  rows={3}
                  maxLength={REVIEW_NOTE_MAX_LENGTH}
                  placeholder={t("deck.explanationPlaceholder")}
                  aria-invalid={!!noteError}
                  onChange={(event) => setNote(event.target.value)}
                />
                {noteError && <p className="text-xs text-destructive">{noteError}</p>}
              </div>
              <div className="flex gap-2">
                <Button disabled={isPending} className={BIG_BUTTON} onClick={() => setReviewTopic(null)}>
                  <ArrowLeft />
                  {t("deck.back")}
                </Button>
                <Button disabled={isPending} className={BIG_BUTTON} onClick={() => submit("confirm", { action: "marked_not_roster", reviewTopic, reviewNote: note })}>
                  {busyAction === "confirm" ? <Loader2 className="animate-spin" /> : <Check />}
                  {t("deck.confirm")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button disabled={isPending} className={BIG_BUTTON} onClick={next}>
                <ChevronsRight />
                {t("deck.next")}
              </Button>
              {canManage && (
                <>
                  <Button disabled={isPending} className={BIG_BUTTON} onClick={editTeam}>
                    <Pencil />
                    {t("actions.editTeam")}
                  </Button>
                  <Button disabled={isPending} className={BIG_BUTTON} onClick={() => submit("done", { action: "team_edited" })}>
                    {busyAction === "done" ? <Loader2 className="animate-spin" /> : <Check />}
                    {t("actions.done")}
                  </Button>
                  <Button disabled={isPending} className={BIG_BUTTON} onClick={() => submit("ignore", { action: "ignored" })}>
                    {busyAction === "ignore" ? <Loader2 className="animate-spin" /> : <EyeOff />}
                    {t("actions.ignore")}
                  </Button>
                  <Button disabled={isPending} className={BIG_BUTTON} onClick={() => setPickingTopic(true)}>
                    <XCircle />
                    {t("actions.notRoster")}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
