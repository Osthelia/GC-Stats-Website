/**
 * GC-Stats - public-api-keys-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { createPublicApiKey, revokePublicApiKey } from "@/actions/public-api-keys";
import { useConfirmClick } from "@/lib/use-confirm-click";
import { FormattedDate } from "@/components/formatted-date";
import { PUBLIC_API_KEY_FIELD_LIMITS, type PublicApiKeyField, type PublicApiKeyFieldErrors } from "@/lib/public-api/config-shared";
import type { PublicApiKeyRow } from "@/lib/public-api-keys";
import { SettingsCard } from "./settings-card";

const inputClass =
  "w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid=true]:border-[#e08585]/70";

function Required() {
  return <span className="ml-0.5 text-[#e08585]">*</span>;
}

function RevokeButton({ label, confirmLabel, disabled, onConfirm }: { label: string; confirmLabel: string; disabled: boolean; onConfirm: () => void }) {
  const { confirming, handleClick } = useConfirmClick(onConfirm);
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium text-[#e08585] transition-colors hover:bg-[#e08585]/10 active:bg-[#e08585]/20 disabled:opacity-60"
    >
      {confirming ? confirmLabel : label}
    </button>
  );
}

function NewKeyReveal({ plainKey, onDismiss }: { plainKey: string; onDismiss: () => void }) {
  const t = useTranslations("accountSettings.publicApi");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-[#7cc48a]/40 bg-[#7cc48a]/5 p-4">
      <p className="text-[13.5px] font-semibold text-[#7cc48a]">{t("created.title")}</p>
      <p className="text-[13px] text-neutral-400">{t("created.warning")}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-[8px] border border-neutral-800 bg-black/30 px-3 py-2 font-mono text-[12.5px] text-neutral-100">{plainKey}</code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t("created.copy")}
          className="flex size-9 flex-none items-center justify-center rounded-[8px] border border-neutral-700 bg-[var(--gcs-surface-2)] text-neutral-200 transition-all hover:bg-[var(--gcs-hover)] active:scale-[0.95]"
        >
          {copied ? <Check className="size-4 text-[#7cc48a]" /> : <Copy className="size-4" />}
        </button>
      </div>
      <button type="button" onClick={onDismiss} className="w-fit rounded-[8px] px-3 py-1.5 text-[13px] font-medium text-neutral-300 transition-colors hover:bg-white/5 active:bg-white/10">
        {t("created.dismiss")}
      </button>
    </div>
  );
}

export function PublicApiKeysSettings({ keys, blocked, discordUrl, enabled, ratePerSecond, maxKeys }: { keys: PublicApiKeyRow[]; blocked: boolean; discordUrl: string; enabled: boolean; ratePerSecond: number; maxKeys: number }) {
  const t = useTranslations("accountSettings.publicApi");
  const tCommon = useTranslations("accountSettings");
  const router = useRouter();

  const [clientName, setClientName] = useState("");
  const [usageDescription, setUsageDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PublicApiKeyFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [plainKey, setPlainKey] = useState<string | null>(null);

  const usedSlots = keys.filter((k) => k.isActive || k.suspended).length;
  const canCreate = enabled && !blocked && usedSlots < maxKeys;

  const fieldError = (field: PublicApiKeyField) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`, PUBLIC_API_KEY_FIELD_LIMITS[field]) : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);
    try {
      const result = await createPublicApiKey({ clientName, usageDescription });
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setError(result.error === "tooManyKeys" ? t("error.tooManyKeys", { max: result.max ?? maxKeys }) : t(`error.${result.error}`));
        return;
      }
      setPlainKey(result.plainKey);
      setClientName("");
      setUsageDescription("");
      router.refresh();
    } catch {
      setError(t("error.network"));
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(id: number) {
    setRevokingId(id);
    try {
      const result = await revokePublicApiKey(id);
      if (!result.ok) setError(t(`error.${result.error}`));
      else router.refresh();
    } catch {
      setError(t("error.network"));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3 rounded-[12px] border border-[#e4ae22]/30 bg-[#e4ae22]/5 p-4">
        <AlertTriangle className="mt-0.5 size-5 flex-none text-[#e4ae22]" />
        <div className="flex flex-col gap-1.5 text-[13.5px] leading-[1.6] text-neutral-300">
          <p>{t("notice.rateLimit", { rate: ratePerSecond })}</p>
          <p>{t("notice.stable")}</p>
          <p>{t("notice.noWebhooks")}</p>
          <Link href="/developers-doc" className="w-fit font-semibold text-[#e4ae22] underline-offset-4 transition-colors hover:underline active:opacity-70">
            {t("notice.requestPartner")}
          </Link>
        </div>
      </div>

      <SettingsCard heading={t("create.heading")} description={t("create.description", { max: maxKeys })}>
        {plainKey && (
          <div className="mb-5">
            <NewKeyReveal plainKey={plainKey} onDismiss={() => setPlainKey(null)} />
          </div>
        )}
        {blocked ? (
          <p className="text-[13.5px] text-[#e08585]">
            {t("blocked")}{" "}
            <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 transition-colors hover:underline active:opacity-70">
              {t("contactDiscord")}
            </a>
          </p>
        ) : !enabled ? (
          <p className="text-[13.5px] text-neutral-500">{t("error.disabled")}</p>
        ) : !canCreate ? (
          <p className="text-[13.5px] text-neutral-500">{t("error.tooManyKeys", { max: maxKeys })}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
            <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
              <span>
                {t("create.clientName")}
                <Required />
              </span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                maxLength={PUBLIC_API_KEY_FIELD_LIMITS.clientName.max}
                placeholder={t("create.clientNamePlaceholder")}
                aria-invalid={!!fieldErrors.clientName}
                className={inputClass}
              />
              {fieldError("clientName") && (
                <span role="alert" className="text-[12.5px] text-[#e08585]">
                  {fieldError("clientName")}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
              <span>
                {t("create.usageDescription")}
                <Required />
              </span>
              <textarea
                value={usageDescription}
                onChange={(e) => setUsageDescription(e.target.value)}
                maxLength={PUBLIC_API_KEY_FIELD_LIMITS.usageDescription.max}
                rows={4}
                placeholder={t("create.usageDescriptionPlaceholder")}
                aria-invalid={!!fieldErrors.usageDescription}
                className={`${inputClass} resize-y`}
              />
              {fieldError("usageDescription") && (
                <span role="alert" className="text-[12.5px] text-[#e08585]">
                  {fieldError("usageDescription")}
                </span>
              )}
            </label>
            <p className="text-[12.5px] leading-[1.6] text-neutral-500">
              {t.rich("create.termsNote", {
                terms: (chunks) => (
                  <Link href="/terms" className="text-[#e4ae22] underline-offset-4 transition-colors hover:underline active:opacity-70">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            {error && (
              <p role="alert" className="text-[13px] text-[#e08585]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-fit items-center gap-2 rounded-[9px] bg-[#e4ae22] px-4 py-2.5 text-[14px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {t("create.submit")}
            </button>
          </form>
        )}
      </SettingsCard>

      <SettingsCard heading={t("list.heading")}>
        {keys.length === 0 ? (
          <p className="text-[13.5px] text-neutral-500">{t("list.empty")}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {keys.map((key) => (
              <div key={key.id} className="flex flex-wrap items-start gap-3 rounded-[10px] border border-neutral-800 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14.5px] font-medium text-neutral-100">{key.clientName}</p>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${key.suspended ? "bg-amber-500/15 text-amber-400" : key.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-500/15 text-neutral-400"}`}
                    >
                      {key.suspended ? t("list.suspended") : key.isActive ? t("list.active") : t("list.revoked")}
                    </span>
                  </div>
                  {key.usageDescription && <p className="mt-1 line-clamp-2 text-[12.5px] text-neutral-400">{key.usageDescription}</p>}
                  {key.suspended && (
                    <p className="mt-1 text-[12.5px] text-amber-400">
                      {t("list.suspendedHint")}{" "}
                      <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 transition-colors hover:underline active:opacity-70">
                        {t("contactDiscord")}
                      </a>
                    </p>
                  )}
                  <p className="mt-1 text-[12px] text-neutral-500">
                    <span className="font-mono">{key.keyHashPreview}…</span> · <FormattedDate date={key.createdAt} mode="date" /> · {t("list.requests", { count: key.requests30d })}
                  </p>
                </div>
                {key.isActive && !key.suspended && <RevokeButton label={t("list.revoke")} confirmLabel={tCommon("confirmClick")} disabled={revokingId === key.id} onConfirm={() => handleRevoke(key.id)} />}
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
