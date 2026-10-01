/**
 * GC-Stats - password-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { setPassword, removePassword } from "@/actions/account-settings";
import { useConfirmClick } from "@/lib/use-confirm-click";
import { SettingsCard } from "./settings-card";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

export function PasswordSettings({ hasPassword, canRemove }: { hasPassword: boolean; canRemove: boolean }) {
  const t = useTranslations("accountSettings.password");
  const tCommon = useTranslations("accountSettings");
  const { update } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setPending(true);

    const result = await setPassword({ currentPassword, newPassword, newPasswordConfirmation });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Every session was invalidated: the one-time reissue token keeps this tab signed in.
    await update({ reissueToken: result.reissueToken });
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setStatus(t("success"));
  }

  async function handleRemove() {
    setError(null);
    setStatus(null);
    setPending(true);
    const result = await removePassword();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await update({ reissueToken: result.reissueToken });
    setStatus(t("removeSuccess"));
  }

  const { confirming: confirmingRemove, handleClick: handleRemoveClick } = useConfirmClick(handleRemove);

  return (
    <SettingsCard heading={t("heading")} description={hasPassword ? t("changeDescription") : t("setDescription")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        {hasPassword && (
          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            {t("currentLabel")}
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
          {t("newLabel")}
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
          {t("confirmLabel")}
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
        {status && <p className="text-[13px] text-[#7cc48a]">{status}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
          >
            {hasPassword ? t("submitChange") : t("submitSet")}
          </button>
          {hasPassword && canRemove && (
            <button
              type="button"
              onClick={handleRemoveClick}
              disabled={pending}
              className="rounded-[9px] px-4 py-2.5 text-[14px] font-medium text-[#e08585] transition-colors hover:bg-[#e08585]/10 disabled:opacity-60"
            >
              {confirmingRemove ? tCommon("confirmClick") : t("remove")}
            </button>
          )}
        </div>
      </form>
    </SettingsCard>
  );
}
