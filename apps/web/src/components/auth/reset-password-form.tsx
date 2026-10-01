/**
 * GC-Stats - reset-password-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { resetPassword } from "@/actions/password-reset";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

type ErrorKey = "invalidOrExpired" | "tooShort" | "mismatch";

export function ResetPasswordForm({ email, token }: { email: string | null; token: string | null }) {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [error, setError] = useState<ErrorKey | null>(!email || !token ? "invalidOrExpired" : null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !token) return;
    setError(null);
    setPending(true);
    const result = await resetPassword(email, token, newPassword, newPasswordConfirmation);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <div className="w-full max-w-[420px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] px-8 py-8 text-center">
        <p className="text-[14.5px] text-[#7cc48a]">{t("success")}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] px-8 py-8">
      {!email || !token ? (
        <p className="text-[13.5px] text-[#e08585]">{t("error.invalidOrExpired")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            <span>
              {t("newLabel")}
              <span className="text-red-500" aria-hidden>
                {" *"}
              </span>
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            <span>
              {t("confirmLabel")}
              <span className="text-red-500" aria-hidden>
                {" *"}
              </span>
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPasswordConfirmation}
              onChange={(e) => setNewPasswordConfirmation(e.target.value)}
              className={inputClass}
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
      )}

      <p className="mt-6 text-center text-[13.5px] text-neutral-500">
        <Link href="/login" className="font-medium text-neutral-100 hover:text-[#e4ae22]">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
