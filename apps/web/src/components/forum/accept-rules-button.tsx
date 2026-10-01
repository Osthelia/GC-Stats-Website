/**
 * GC-Stats - accept-rules-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { acceptForumRules } from "@/actions/forum";

export function AcceptRulesButton() {
  const t = useTranslations("forum.rules");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(false);
    const result = await acceptForumRules();
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-[9px] bg-[#e4ae22] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
      >
        {pending ? t("accepting") : t("accept")}
      </button>
      {error && <p className="text-[13px] text-[#e08585]">{t("acceptError")}</p>}
    </div>
  );
}
