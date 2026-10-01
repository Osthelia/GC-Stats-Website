/**
 * GC-Stats - two-factor-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { setupTwoFactor, confirmTwoFactor, disableTwoFactor, regenerateRecoveryCodes } from "@/actions/two-factor";
import { SettingsCard } from "./settings-card";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

type Step = "idle" | "setup" | "recovery-codes";

export function TwoFactorSettings({ hasPassword, enabled }: { hasPassword: boolean; enabled: boolean }) {
  const t = useTranslations("accountSettings.twoFactor");
  const router = useRouter();
  const { update } = useSession();

  const [step, setStep] = useState<Step>("idle");
  const [secret, setSecret] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [showDisableForm, setShowDisableForm] = useState(false);
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [password, setPassword] = useState("");

  async function handleEnable() {
    setError(null);
    setPending(true);
    const result = await setupTwoFactor();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSecret(result.secret);
    setQrCodeDataUrl(result.qrCodeDataUrl);
    setStep("setup");
  }

  async function handleConfirm() {
    setError(null);
    setPending(true);
    const result = await confirmTwoFactor(code);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRecoveryCodes(result.recoveryCodes);
    setStep("recovery-codes");
  }

  function handleDone() {
    setStep("idle");
    setCode("");
    router.refresh();
  }

  async function handleDisable() {
    setError(null);
    setPending(true);
    const result = await disableTwoFactor(password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Every session was invalidated: the one-time reissue token keeps this tab signed in.
    await update({ reissueToken: result.reissueToken });
    setPassword("");
    setShowDisableForm(false);
    router.refresh();
  }

  async function handleRegenerate() {
    setError(null);
    setPending(true);
    const result = await regenerateRecoveryCodes(password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPassword("");
    setShowRegenerateForm(false);
    setRecoveryCodes(result.recoveryCodes);
    setStep("recovery-codes");
  }

  if (step === "setup") {
    return (
      <SettingsCard heading={t("heading")}>
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-[1.6] text-neutral-400">{t("setupDescription")}</p>
          {qrCodeDataUrl && (
            // Locally generated data: URL (qrcode package), not a remote image, so next/image adds no value here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCodeDataUrl} alt={t("qrCodeAlt")} className="h-[180px] w-[180px] self-start rounded-[10px] bg-white p-2" />
          )}
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-neutral-500">{t("manualEntryLabel")}</span>
            <code className="select-all break-all rounded-[8px] border border-neutral-800 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13px] text-neutral-200">
              {secret}
            </code>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            {t("codeLabel")}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && (
            <p role="alert" className="text-[13px] text-[#e08585]">
              {t(`error.${error}`)}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
            >
              {t("confirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setCode("");
                setError(null);
              }}
              className="rounded-[9px] px-4 py-2.5 text-[14px] font-medium text-neutral-400 transition-colors hover:text-neutral-100"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      </SettingsCard>
    );
  }

  if (step === "recovery-codes") {
    return (
      <SettingsCard heading={t("heading")}>
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-[1.6] text-neutral-400">{t("recoveryCodesDescription")}</p>
          <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface-2)] p-4">
            {recoveryCodes.map((rc) => (
              <code key={rc} className="text-[13.5px] text-neutral-200">
                {rc}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={handleDone}
            className="self-start rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f]"
          >
            {t("recoveryCodesSaved")}
          </button>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard heading={t("heading")} description={hasPassword ? undefined : t("passwordRequiredHint")}>
      <div className="flex flex-col gap-4">
        {hasPassword && (
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2 w-2 flex-none rounded-full ${enabled ? "bg-[#7cc48a]" : "bg-neutral-600"}`}
              aria-hidden="true"
            />
            <span className="text-[13.5px] text-neutral-300">{enabled ? t("enabled") : t("disabled")}</span>
          </div>
        )}

        {error && !showDisableForm && !showRegenerateForm && (
          <p role="alert" className="text-[13px] text-[#e08585]">
            {t(`error.${error}`)}
          </p>
        )}

        {hasPassword && !enabled && (
          <button
            type="button"
            onClick={handleEnable}
            disabled={pending}
            className="self-start rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
          >
            {t("enable")}
          </button>
        )}

        {hasPassword && enabled && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRegenerateForm((v) => !v);
                  setShowDisableForm(false);
                  setError(null);
                }}
                className="rounded-[9px] border border-neutral-700 px-4 py-2.5 text-[14px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--gcs-hover)]"
              >
                {t("regenerateRecoveryCodes")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisableForm((v) => !v);
                  setShowRegenerateForm(false);
                  setError(null);
                }}
                className="rounded-[9px] px-4 py-2.5 text-[14px] font-medium text-[#e08585] transition-colors hover:bg-[#e08585]/10"
              >
                {t("disable")}
              </button>
            </div>

            {(showDisableForm || showRegenerateForm) && (
              <div className="flex flex-col gap-3 rounded-[10px] border border-neutral-800 p-4">
                <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
                  {t("confirmPasswordLabel")}
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </label>
                {error && (
                  <p role="alert" className="text-[13px] text-[#e08585]">
                    {t(`error.${error}`)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={showDisableForm ? handleDisable : handleRegenerate}
                  disabled={pending}
                  className="self-start rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
                >
                  {showDisableForm ? t("disable") : t("regenerateRecoveryCodes")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
