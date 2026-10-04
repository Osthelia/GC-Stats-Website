/**
 * GC-Stats - news-status-actions
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLinkIcon } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormattedDate } from "@/components/formatted-date";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { useDisplayTimezone } from "@/lib/site-settings";
import { timezoneLabel } from "@/lib/datetime-local";
import {
  submitDashboardNewsForReview,
  approveDashboardNewsArticle,
  requestDashboardNewsChanges,
  publishDashboardNewsArticle,
  unpublishDashboardNewsArticle,
  archiveDashboardNewsArticle,
  unarchiveDashboardNewsArticle,
  deleteDashboardNewsArticle,
  toggleDashboardNewsFeature,
  toggleDashboardNewsShowOnHome,
} from "@/actions/dashboard-news";
import type { DashboardNewsArticleDetail } from "@/lib/dashboard-news-data";

export function NewsStatusActions({
  organizationId,
  article,
  canEdit,
  canReview = false,
  canPublish,
  canDelete,
  listHref,
}: {
  organizationId: number | null;
  article: DashboardNewsArticleDetail;
  canEdit: boolean;
  canReview?: boolean;
  canPublish: boolean;
  canDelete: boolean;
  listHref: string;
}) {
  const t = useTranslations("dashboard.news");
  const locale = useLocale();
  const timeZone = useDisplayTimezone();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isFeatured, setIsFeatured] = useState(article.isFeatured);
  const [showOnHome, setShowOnHome] = useState(article.showOnHome);
  const [scheduleValue, setScheduleValue] = useState<string | null>(null);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  const isOrgScoped = organizationId !== null;

  function handleSubmitForReview() {
    if (organizationId === null) return;
    startTransition(async () => {
      const result = await submitDashboardNewsForReview(organizationId, article.id);
      if (!result.ok) {
        toast.error(t(`review.error.${result.error}`));
        return;
      }
      toast.success(t("review.submitSuccess"));
      router.refresh();
    });
  }

  function handleApprove() {
    if (organizationId === null) return;
    startTransition(async () => {
      const result = await approveDashboardNewsArticle(organizationId, article.id);
      if (!result.ok) {
        toast.error(t(`review.error.${result.error}`));
        return;
      }
      toast.success(t("review.approveSuccess"));
      router.refresh();
    });
  }

  function handleRequestChanges() {
    if (organizationId === null) return;
    startTransition(async () => {
      const result = await requestDashboardNewsChanges(organizationId, article.id, changesNote);
      if (!result.ok) {
        toast.error(t(`review.error.${result.error}`));
        return;
      }
      setChangesDialogOpen(false);
      setChangesNote("");
      toast.success(t("review.requestChangesSuccess"));
      router.refresh();
    });
  }

  function handlePublish() {
    startTransition(async () => {
      const result = await publishDashboardNewsArticle(organizationId, article.id, scheduleValue);
      if (!result.ok) {
        toast.error(t(`review.error.${result.error}`));
        return;
      }
      toast.success(scheduleValue ? t("scheduleSuccess") : t("publishSuccess"));
      setScheduleValue("");
      router.refresh();
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveDashboardNewsArticle(organizationId, article.id);
      setConfirmArchive(false);
      if (!result.ok) {
        toast.error(t("archiveError"));
        return;
      }
      toast.success(t("archiveSuccess"));
      router.refresh();
    });
  }

  function handleUnarchive() {
    startTransition(async () => {
      const result = await unarchiveDashboardNewsArticle(organizationId, article.id);
      if (!result.ok) {
        toast.error(t("unarchiveError"));
        return;
      }
      toast.success(t("unarchiveSuccess"));
      router.refresh();
    });
  }

  function handleUnpublish() {
    startTransition(async () => {
      const result = await unpublishDashboardNewsArticle(organizationId, article.id);
      setConfirmUnpublish(false);
      if (!result.ok) {
        toast.error(t("unpublishError"));
        return;
      }
      toast.success(t("unpublishSuccess"));
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDashboardNewsArticle(organizationId, article.id);
      if (!result.ok) {
        setConfirmDelete(false);
        toast.error(t("deleteError"));
        return;
      }
      toast.success(t("deleteSuccess"));
      router.push(listHref);
    });
  }

  function handleToggleFeatured(checked: boolean) {
    setIsFeatured(checked);
    startTransition(async () => {
      const result = await toggleDashboardNewsFeature(organizationId, article.id, checked);
      if (!result.ok) {
        setIsFeatured(!checked);
        toast.error(t("featureError"));
      }
    });
  }

  function handleToggleShowOnHome(checked: boolean) {
    setShowOnHome(checked);
    startTransition(async () => {
      const result = await toggleDashboardNewsShowOnHome(organizationId, article.id, checked);
      if (!result.ok) {
        setShowOnHome(!checked);
        toast.error(t("showOnHomeError"));
      }
    });
  }

  const statusLabel = article.isScheduled ? t("status.scheduled") : t(`status.${article.status}`);
  const statusVariant = article.status === "published" && !article.isScheduled ? "default" : article.status === "archived" ? "secondary" : "outline";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={statusVariant} className="w-fit">
          {statusLabel}
        </Badge>
        <Button variant="outline" size="sm" render={<Link href={`/news/${article.slug}`} target="_blank" rel="noopener noreferrer" />}>
          <ExternalLinkIcon className="size-4" />
          {t("viewPublicButton")}
        </Button>
      </div>

      {article.isScheduled && article.publishedAt && (
        <p className="text-sm text-muted-foreground">
          {t("scheduledFor")} <FormattedDate date={article.publishedAt} mode="datetime" />
        </p>
      )}

      <div className="flex flex-col gap-2">
        {/* Org-scoped PR-style review flow */}
        {isOrgScoped && canEdit && (article.status === "draft" || article.status === "changes_requested") && (
          <Button size="sm" disabled={isPending} onClick={handleSubmitForReview}>
            {t("review.submitButton")}
          </Button>
        )}

        {isOrgScoped && article.status === "in_review" && !canReview && <p className="text-sm text-muted-foreground">{t("review.waitingForReview")}</p>}

        {isOrgScoped && canReview && article.status === "in_review" && (
          <div className="flex flex-col gap-2">
            <Button size="sm" disabled={isPending} onClick={handleApprove}>
              {t("review.approveButton")}
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setChangesDialogOpen(true)}>
              {t("review.requestChangesButton")}
            </Button>
          </div>
        )}

        {/* Publish (both scopes): org scope only once approved, and never once already published */}
        {canPublish && article.status !== "published" && (!isOrgScoped || article.status === "approved") && (
          <div className="flex flex-col gap-2 rounded-lg border p-2.5">
            <Button size="sm" disabled={isPending} onClick={handlePublish}>
              {t("publishButton")}
            </Button>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="news-schedule" className="text-xs text-muted-foreground">
                {t("scheduleLabel")} <span className="tabular-nums">({timezoneLabel(timeZone, locale)})</span>
              </label>
              <div className="flex gap-1.5">
                <DateTimeInput id="news-schedule" value={scheduleValue} onChange={setScheduleValue} showTimezone={false} className="flex-1" />
                <Button size="sm" variant="outline" disabled={isPending || !scheduleValue} onClick={handlePublish}>
                  {t("scheduleButton")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {canPublish && article.status === "published" && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmUnpublish(true)}>
            {t("unpublishButton")}
          </Button>
        )}

        {canDelete && article.status === "archived" && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleUnarchive}>
            {t("unarchiveButton")}
          </Button>
        )}

        {canDelete && article.status !== "archived" && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmArchive(true)}>
            {t("archiveButton")}
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmDelete(true)} className="text-destructive hover:text-destructive">
            {t("deleteButton")}
          </Button>
        )}
      </div>

      {canPublish && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isFeatured} disabled={isPending} onCheckedChange={(checked) => handleToggleFeatured(checked === true)} />
            {t("editor.featuredLabel")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showOnHome} disabled={isPending} onCheckedChange={(checked) => handleToggleShowOnHome(checked === true)} />
            {t("editor.showOnHomeLabel")}
          </label>
        </div>
      )}

      <Dialog open={changesDialogOpen} onOpenChange={(next) => !isPending && setChangesDialogOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("review.requestChangesButton")}</DialogTitle>
            <DialogDescription>{t("review.requestChangesHint")}</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={changesNote} onChange={(e) => setChangesNote(e.target.value)} placeholder={t("review.requestChangesPlaceholder")} />
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setChangesDialogOpen(false)}>
              {t("review.cancel")}
            </Button>
            <Button disabled={isPending || !changesNote.trim()} onClick={handleRequestChanges}>
              {t("review.requestChangesButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title={t("confirmTitle")}
        description={t("unpublishConfirm", { title: article.title })}
        confirmLabel={t("unpublishButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleUnpublish}
        isPending={isPending}
        destructive={false}
      />

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("confirmTitle")}
        description={t("archiveConfirm", { title: article.title })}
        confirmLabel={t("archiveButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleArchive}
        isPending={isPending}
        destructive={false}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("confirmTitle")}
        description={t("deleteConfirm", { title: article.title })}
        confirmLabel={t("deleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
        destructive
      />
    </div>
  );
}
