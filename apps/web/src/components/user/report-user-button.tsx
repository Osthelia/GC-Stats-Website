/**
 * GC-Stats - report-user-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ReportUserDialog } from "@/components/user/report-user-dialog";

export function ReportUserButton({ userId, canReport }: { userId: string; canReport: boolean }) {
  const t = useTranslations("userPage.report");
  const [open, setOpen] = useState(false);

  if (!canReport) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5c4c22] hover:text-[#e08585] active:scale-[0.97]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <path d="M4 22V15" />
        </svg>
        {t("button")}
      </button>
      {open && <ReportUserDialog userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}
