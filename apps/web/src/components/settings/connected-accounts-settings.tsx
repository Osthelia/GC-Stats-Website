/**
 * GC-Stats - connected-accounts-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { unlinkAccount } from "@/actions/account-settings";
import { DiscordIcon, TwitchIcon, XIcon } from "@/components/icons/brand-icons";
import { useConfirmClick } from "@/lib/use-confirm-click";
import { SettingsCard } from "./settings-card";

const PROVIDERS = [
  { id: "discord", label: "Discord", Icon: DiscordIcon, color: "#5865F2" },
  { id: "twitch", label: "Twitch", Icon: TwitchIcon, color: "#9146FF" },
  { id: "twitter", label: "X", Icon: XIcon, color: "#000000" },
] as const;

function UnlinkButton({ label, confirmLabel, disabled, onConfirm }: { label: string; confirmLabel: string; disabled: boolean; onConfirm: () => void }) {
  const { confirming, handleClick } = useConfirmClick(onConfirm);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium text-[#e08585] transition-colors hover:bg-[#e08585]/10 disabled:opacity-60"
    >
      {confirming ? confirmLabel : label}
    </button>
  );
}

export function ConnectedAccountsSettings({
  linkedProviders,
  canUnlink,
  linkedNotice,
  linkErrorNotice,
}: {
  linkedProviders: string[];
  canUnlink: boolean;
  linkedNotice?: string;
  linkErrorNotice?: string;
}) {
  const t = useTranslations("accountSettings.connectedAccounts");
  const tCommon = useTranslations("accountSettings");
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [linked, setLinked] = useState(new Set(linkedProviders));
  const [notice, setNotice] = useState(linkedNotice ? { type: "success" as const, provider: linkedNotice } : null);
  const [noticeError, setNoticeError] = useState(linkErrorNotice ?? null);

  async function handleConnect(provider: string) {
    setPendingProvider(provider);
    await signIn(provider, { callbackUrl: "/settings/account" });
  }

  async function handleUnlink(provider: string) {
    setPendingProvider(provider);
    setErrors((prev) => ({ ...prev, [provider]: "" }));
    const result = await unlinkAccount(provider);
    setPendingProvider(null);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [provider]: result.error }));
      return;
    }
    setLinked((prev) => {
      const next = new Set(prev);
      next.delete(provider);
      return next;
    });
  }

  return (
    <SettingsCard heading={t("heading")}>
      <div className="flex flex-col gap-2.5">
        {notice && (
          <p className="text-[13px] text-[#7cc48a]">{t("linkedSuccess", { provider: PROVIDERS.find((p) => p.id === notice.provider)?.label ?? notice.provider })}</p>
        )}
        {noticeError && (
          <p role="alert" className="text-[13px] text-[#e08585]">
            {t(`error.${noticeError}`)}
          </p>
        )}

        {PROVIDERS.map(({ id, label, Icon, color }) => {
          const isLinked = linked.has(id);
          return (
            <div key={id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 rounded-[10px] border border-neutral-800 px-4 py-3">
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-white"
                  style={{ background: color }}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-[14.5px] font-medium text-neutral-100">{label}</span>
                <span className={`text-[13px] ${isLinked ? "text-[#7cc48a]" : "text-neutral-500"}`}>
                  {isLinked ? t("linked") : t("notLinked")}
                </span>
                {isLinked && canUnlink && (
                  <UnlinkButton
                    label={t("unlink")}
                    confirmLabel={tCommon("confirmClick")}
                    disabled={pendingProvider === id}
                    onConfirm={() => handleUnlink(id)}
                  />
                )}
                {!isLinked && (
                  <button
                    type="button"
                    onClick={() => handleConnect(id)}
                    disabled={pendingProvider === id}
                    className="rounded-[8px] border border-neutral-700 px-3 py-1.5 text-[13px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--gcs-hover)] disabled:opacity-60"
                  >
                    {t("connect")}
                  </button>
                )}
              </div>
              {errors[id] && (
                <p role="alert" className="text-[12.5px] text-[#e08585]">
                  {t(`error.${errors[id]}`)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}
