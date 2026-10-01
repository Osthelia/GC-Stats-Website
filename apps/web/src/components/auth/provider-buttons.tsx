/**
 * GC-Stats - provider-buttons
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { DiscordIcon, TwitchIcon, XIcon } from "@/components/icons/brand-icons";

type Provider = "discord" | "twitch" | "twitter";

export function ProviderButtons({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("auth");
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);

  function handleSignIn(provider: Provider) {
    setPendingProvider(provider);
    signIn(provider, { callbackUrl: callbackUrl ?? "/" });
  }

  const disabled = pendingProvider !== null;

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => handleSignIn("discord")}
        disabled={disabled}
        className="flex items-center justify-center gap-2.5 rounded-[10px] bg-[#5865F2] py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[#4752C4] active:bg-[#3c45a5] disabled:opacity-60"
      >
        <DiscordIcon className="h-5 w-5 flex-none" />
        {pendingProvider === "discord" ? "…" : t("discord")}
      </button>
      <button
        type="button"
        onClick={() => handleSignIn("twitch")}
        disabled={disabled}
        className="flex items-center justify-center gap-2.5 rounded-[10px] bg-[#9146FF] py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-[#772CE8] active:bg-[#651fd1] disabled:opacity-60"
      >
        <TwitchIcon className="h-5 w-5 flex-none" />
        {pendingProvider === "twitch" ? "…" : t("twitch")}
      </button>
      <button
        type="button"
        onClick={() => handleSignIn("twitter")}
        disabled={disabled}
        className="flex items-center justify-center gap-2.5 rounded-[10px] bg-black py-3 text-[14.5px] font-medium text-white transition-colors hover:bg-neutral-900 active:bg-neutral-800 disabled:opacity-60"
      >
        <XIcon className="h-[18px] w-[18px] flex-none" />
        {pendingProvider === "twitter" ? "…" : t("twitter")}
      </button>
    </div>
  );
}
