/**
 * GC-Stats - email-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { requestEmailChange, resendEmailVerification } from "@/actions/account-settings";
import { SettingsCard } from "./settings-card";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

export function EmailSettings({
  currentEmail,
  emailVerified,
  hasPassword,
}: {
  currentEmail: string;
  emailVerified: boolean;
  hasPassword: boolean;
}) {
  const t = useTranslations("accountSettings.email");

  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  async function handleSendVerification() {
    setVerifyError(null);
    setVerifySent(false);
    setVerifyPending(true);
    const result = await resendEmailVerification();
    setVerifyPending(false);
    if (!result.ok) {
      setVerifyError(result.error);
      return;
    }
    setVerifySent(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setPending(true);

    const result = await requestEmailChange({ newEmail, currentPassword });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(t("success", { email: newEmail.trim().toLowerCase() }));
    setNewEmail("");
    setCurrentPassword("");
  }

  return (
    <SettingsCard heading={t("heading")} description={t("description")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
          {t("currentLabel")}
          <input type="email" value={currentEmail} disabled readOnly className={`${inputClass} opacity-60`} />
        </label>

        {currentEmail &&
          (emailVerified ? (
            <p className="text-[13px] text-[#7cc48a]">{t("verification.verified")}</p>
          ) : (
            <div className="flex flex-col gap-2.5 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface-2)] p-3.5">
              <p className="text-[13px] text-neutral-300">{t("verification.unverified")}</p>
              <div>
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={verifyPending}
                  className="rounded-[9px] border border-neutral-700 px-3.5 py-2 text-[13.5px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--gcs-hover)] active:bg-[var(--gcs-surface)] disabled:opacity-60"
                >
                  {verifyPending ? t("verification.sending") : t("verification.send")}
                </button>
              </div>
              {verifyError && (
                <p role="alert" className="text-[13px] text-[#e08585]">
                  {t(`verification.error.${verifyError}`)}
                </p>
              )}
              {verifySent && <p className="text-[13px] text-[#7cc48a]">{t("verification.sent", { email: currentEmail })}</p>}
            </div>
          ))}

        <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
          <span className="flex items-center gap-1">
            {t("newLabel")}
            <span className="text-[#e08585]">*</span>
          </span>
          <input
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            aria-invalid={!!error && error !== "currentRequired" && error !== "currentInvalid"}
            className={inputClass}
          />
        </label>

        {hasPassword && (
          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            <span className="flex items-center gap-1">
              {t("currentPasswordLabel")}
              <span className="text-[#e08585]">*</span>
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              aria-invalid={error === "currentRequired" || error === "currentInvalid"}
              className={inputClass}
            />
          </label>
        )}

        {error && (
          <p role="alert" className="text-[13px] text-[#e08585]">
            {t(`error.${error}`)}
          </p>
        )}
        {status && <p className="text-[13px] text-[#7cc48a]">{status}</p>}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
          >
            {t("submit")}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
