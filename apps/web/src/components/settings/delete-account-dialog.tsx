/**
 * GC-Stats - delete-account-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { deleteAccount } from "@/actions/account-settings";

const inputClass =
  "w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid=true]:border-[#e08585]";

export function DeleteAccountDialog({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const t = useTranslations("accountSettings.dangerZone.deleteDialog");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await deleteAccount(currentPassword);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-2xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-6 shadow-[0_22px_50px_rgba(0,0,0,.72)]"
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <h2 className="text-[15px] font-semibold text-neutral-50">{t("title")}</h2>
          <p className="text-[13.5px] leading-[1.6] text-neutral-400">{t("warning")}</p>

          {hasPassword && (
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1 text-[13px] text-neutral-400">
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
            <p role="alert" className="text-[13.5px] text-[#e08585]">
              {t(`error.${error}`)}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[9px] bg-[#e08585] px-5 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#d16f6f] active:bg-[#bd5f5f] disabled:opacity-60"
            >
              {pending ? t("submitting") : t("confirm")}
            </button>
            <button type="button" onClick={onClose} className="text-[13.5px] font-medium text-neutral-400 transition-colors hover:text-neutral-200">
              {t("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
