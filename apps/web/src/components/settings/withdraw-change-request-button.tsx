/**
 * GC-Stats - withdraw-change-request-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { withdrawChangeRequest } from "@/actions/change-requests";

export function WithdrawChangeRequestButton({ changeRequestId }: { changeRequestId: number }) {
  const t = useTranslations("accountSettings.changeRequests.detail");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    const result = await withdrawChangeRequest(changeRequestId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-[9px] px-4 py-2.5 text-[13.5px] font-medium text-[#e08585] transition-colors hover:bg-[#e08585]/10"
      >
        {t("withdraw")}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-[9px] border border-[#e08585]/30 bg-[#e08585]/5 p-3">
      <p className="text-[13px] text-neutral-300">{t("withdrawConfirm")}</p>
      {error && <p className="text-[12.5px] text-[#e08585]">{t(`error.${error}`)}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleConfirm}
          className="rounded-[8px] bg-[#e08585] px-3.5 py-2 text-[13px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#d16f6f] disabled:opacity-60"
        >
          {pending ? t("withdrawing") : t("withdrawConfirmButton")}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="rounded-[8px] px-3.5 py-2 text-[13px] font-medium text-neutral-400 hover:text-neutral-200">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
