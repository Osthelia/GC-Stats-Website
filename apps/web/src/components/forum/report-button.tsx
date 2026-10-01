/**
 * GC-Stats - report-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ReportMessageDialog } from "@/components/forum/report-message-dialog";

export function ReportButton({ messageId, canReport }: { messageId: number; canReport: boolean }) {
  const t = useTranslations("forum.message");
  const [open, setOpen] = useState(false);

  if (!canReport) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-medium text-neutral-500 transition-colors hover:text-[#e08585]">
        {t("report")}
      </button>
      {open && <ReportMessageDialog messageId={messageId} onClose={() => setOpen(false)} />}
    </>
  );
}
