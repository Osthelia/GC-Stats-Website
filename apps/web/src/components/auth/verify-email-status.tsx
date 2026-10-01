/**
 * GC-Stats - verify-email-status
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { verifyEmailToken } from "@/actions/verify-email";

type Status = "pending" | "success" | "error";

export function VerifyEmailStatus({ email, token }: { email: string | null; token: string | null }) {
  const t = useTranslations("auth.verifyEmail");
  const [status, setStatus] = useState<Status>("pending");

  useEffect(() => {
    if (!email || !token) {
      setStatus("error");
      return;
    }
    verifyEmailToken(email, token).then((result) => setStatus(result.ok ? "success" : "error"));
  }, [email, token]);

  return (
    <div className="w-full max-w-[420px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] px-8 py-10 text-center">
      {status === "pending" && (
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon className="size-6 animate-spin text-neutral-400" />
          <p className="text-[13.5px] text-neutral-400">{t("pending")}</p>
        </div>
      )}
      {status === "success" && <p className="text-[14.5px] text-[#7cc48a]">{t("success")}</p>}
      {status === "error" && <p className="text-[14.5px] text-[#e08585]">{t("error")}</p>}

      {status !== "pending" && (
        <Link href="/" className="mt-6 inline-block text-[13.5px] font-medium text-neutral-100 hover:text-[#e4ae22]">
          {t("backHome")}
        </Link>
      )}
    </div>
  );
}
