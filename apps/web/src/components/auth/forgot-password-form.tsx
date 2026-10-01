/**
 * GC-Stats - forgot-password-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/actions/password-reset";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");

  const [email, setEmail] = useState("");
  const [error, setError] = useState<"invalid" | "tooManyAttempts" | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await requestPasswordReset(email);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-[420px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] px-8 py-8 text-center">
        <p className="text-[14.5px] text-neutral-200">{t("sent")}</p>
        <Link href="/login" className="mt-6 inline-block text-[13.5px] font-medium text-neutral-100 hover:text-[#e4ae22]">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] px-8 py-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
          <span>
            {t("emailLabel")}
            <span className="text-red-500" aria-hidden>
              {" *"}
            </span>
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            aria-invalid={error === "invalid"}
          />
        </label>

        {error && (
          <p role="alert" className="text-[13px] text-[#e08585]">
            {t(`error.${error}`)}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1.5 rounded-[9px] bg-[#e4ae22] py-3 text-[15px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
        >
          {pending ? "…" : t("submit")}
        </button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-neutral-500">
        <Link href="/login" className="font-medium text-neutral-100 hover:text-[#e4ae22]">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
