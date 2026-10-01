/**
 * GC-Stats - report-review-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { SanctionDialog } from "@/components/admin/sanction-dialog";
import { resolveReport, type ReportFieldErrors } from "@/actions/admin-reports";
import { hideForumMessage } from "@/actions/admin-forum";
import type { AdminReportRow } from "@/lib/admin-reports";

export function ReportReviewDialog({
  report,
  action,
  open,
  onOpenChange,
}: {
  report: AdminReportRow | null;
  action: "resolved" | "dismissed";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.reports");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [hideMessage, setHideMessage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ReportFieldErrors>({});
  const [sanctioning, setSanctioning] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setHideMessage(false);
      setFieldErrors({});
    }
  }, [open, report?.id]);

  function handleSubmit() {
    if (!report) return;
    setFieldErrors({});
    startTransition(async () => {
      const result = await resolveReport(report.id, action, note);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }

      if (action === "resolved" && hideMessage && report.reportedMessageId !== null) {
        try {
          const hideResult = await hideForumMessage(report.reportedMessageId);
          if (!hideResult.ok) {
            toast.error(t("hideMessageError"));
          }
        } catch {
          toast.error(t("hideMessageError"));
        }
      }

      onOpenChange(false);
      router.refresh();
      toast.success(action === "resolved" ? t("resolveSuccess") : t("dismissSuccess"));
    });
  }

  const err = fieldErrors.note ? t(`error.${fieldErrors.note}`) : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "resolved" ? t("resolveTitle") : t("dismissTitle")}</DialogTitle>
            <DialogDescription>{report?.reason}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <FormField label={t("noteLabel")} htmlFor="report-note" required error={err}>
              <Textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} aria-invalid={!!fieldErrors.note} rows={4} />
            </FormField>

            {action === "resolved" && report?.reportedMessageId != null && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hideMessage} onCheckedChange={(checked) => setHideMessage(checked === true)} />
                {t("hideMessageLabel")}
              </label>
            )}

            {action === "resolved" && (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setSanctioning(true)} disabled={isPending}>
                <ShieldAlert className="size-4" />
                {t("sanctionButton")}
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} className={action === "resolved" ? "bg-emerald-600 hover:bg-emerald-700" : undefined} variant={action === "dismissed" ? "outline" : "default"}>
              {isPending ? t("saving") : action === "resolved" ? t("resolveConfirm") : t("dismissConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SanctionDialog
        open={sanctioning}
        onOpenChange={setSanctioning}
        initialUser={report?.reportedUserId ? { id: report.reportedUserId, username: report.reportedUsername } : null}
      />
    </>
  );
}
