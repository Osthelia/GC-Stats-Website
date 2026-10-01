/**
 * GC-Stats - report-message-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { reportForumMessage } from "@/actions/forum";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/report-categories";
import { PublicSelect } from "@/components/forms/public-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const inputClass =
  "w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid=true]:border-[#e08585]";

export function ReportMessageDialog({ messageId, onClose }: { messageId: number; onClose: () => void }) {
  const t = useTranslations("forum.report");
  const [category, setCategory] = useState<ReportCategory>("toxicity");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await reportForumMessage({ messageId, category, reason });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[440px] rounded-2xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-6 text-neutral-50 ring-0 shadow-[0_22px_50px_rgba(0,0,0,.72)]">
        {submitted ? (
          <div className="text-center">
            <p className="mb-4 text-[14.5px] font-semibold text-[#7cc48a]">{t("success")}</p>
            <button type="button" onClick={onClose} className="rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d]">
              {t("close")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="text-[15px] font-semibold text-neutral-50">{t("title")}</DialogTitle>
            </DialogHeader>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1 text-[13px] text-neutral-400">
                {t("categoryLabel")}
                <span className="text-[#e08585]">*</span>
              </span>
              <PublicSelect value={category} onChange={(v) => setCategory(v as ReportCategory)} options={REPORT_CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`) }))} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1 text-[13px] text-neutral-400">
                {t("reasonLabel")}
                <span className="text-[#e08585]">*</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={500}
                aria-invalid={error === "reasonRequired" || error === "reasonTooLong"}
                className={inputClass}
              />
            </label>

            {error && (
              <p role="alert" className="text-[13.5px] text-[#e08585]">
                {t(`error.${error}`)}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
              >
                {pending ? t("submitting") : t("submit")}
              </button>
              <button type="button" onClick={onClose} className="text-[13.5px] font-medium text-neutral-400 transition-colors hover:text-neutral-200">
                {t("cancel")}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
