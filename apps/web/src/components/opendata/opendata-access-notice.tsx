/**
 * GC-Stats - opendata-access-notice
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Lock, PowerOff } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** Shown instead of the data when the portal is switched off, or open to signed in users only. */
export function OpenDataAccessNotice({ reason, callbackPath }: { reason: "disabled" | "accountRequired"; callbackPath: string }) {
  const t = useTranslations("openData.access");
  const Icon = reason === "disabled" ? PowerOff : Lock;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)] text-[#e4ae22]">
        <Icon className="size-5" />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="text-base font-semibold text-neutral-50">{t(`${reason}.title`)}</h2>
        <p className="text-sm leading-relaxed text-neutral-400">{t(`${reason}.text`)}</p>
      </div>
      {reason === "accountRequired" && (
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={{ pathname: "/login", query: { callbackUrl: callbackPath } }}
            className="rounded-[9px] bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition-all hover:bg-[#f0bc33] active:scale-[0.97]"
          >
            {t("login")}
          </Link>
          <Link
            href="/register"
            className="rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-4 py-2 text-[13px] font-semibold text-neutral-200 transition-all hover:bg-[var(--gcs-hover)] active:scale-[0.97]"
          >
            {t("register")}
          </Link>
        </div>
      )}
    </div>
  );
}
