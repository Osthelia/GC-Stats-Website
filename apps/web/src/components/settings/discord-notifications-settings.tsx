/**
 * GC-Stats - discord-notifications-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { updateDiscordNotificationPreferences, refreshDiscordEligibility } from "@/actions/notification-settings";
import { EMAIL_CATEGORIES, type EmailCategory } from "@/lib/notification-categories";
import { SettingsCard } from "./settings-card";

export function DiscordNotificationsSettings({
  initialPrefs,
  initiallyLinked,
  initiallyJoined,
  inviteUrl,
}: {
  initialPrefs: Record<EmailCategory, boolean>;
  initiallyLinked: boolean;
  initiallyJoined: boolean;
  inviteUrl: string | null;
}) {
  const t = useTranslations("accountSettings.discordNotifications");
  const [prefs, setPrefs] = useState(initialPrefs);
  const [linked, setLinked] = useState(initiallyLinked);
  const [joined, setJoined] = useState(initiallyJoined);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible = linked && joined;

  // Toggles apply instantly; saves are debounced and serialized so a slow
  // round trip (the server re-checks Discord guild membership) never blocks
  // the next click, and only the latest state is ever written.
  const savedRef = useRef(initialPrefs);
  const latestRef = useRef(initialPrefs);
  const savingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  async function flush() {
    if (savingRef.current) return;
    const sent = latestRef.current;
    if (sent === savedRef.current) return;
    savingRef.current = true;
    const result = await updateDiscordNotificationPreferences(sent).catch(() => ({ ok: false as const, error: "invalid" }));
    savingRef.current = false;
    if (!result.ok) {
      latestRef.current = savedRef.current;
      setPrefs(savedRef.current);
      setStatus(null);
      setError(t(`error.${result.error}` as never));
      return;
    }
    savedRef.current = sent;
    // Toggled again while this save was in flight: write the newer state.
    if (latestRef.current !== sent) {
      void flush();
      return;
    }
    setStatus(t("saved"));
  }

  function toggle(category: EmailCategory) {
    const next = { ...latestRef.current, [category]: !latestRef.current[category] };
    latestRef.current = next;
    setPrefs(next);
    setStatus(null);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void flush(), 500);
  }

  async function handleRefresh() {
    setRefreshing(true);
    const result = await refreshDiscordEligibility();
    setRefreshing(false);
    setLinked(result.linked);
    setJoined(result.joined);
  }

  return (
    <SettingsCard heading={t("heading")} description={t("description")}>
      {!linked && (
        <div className="flex flex-col items-start gap-2 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface-2)] px-4 py-3">
          <p className="text-[13px] text-[var(--gcs-text-dim)]">{t("notLinked")}</p>
          <button
            type="button"
            onClick={() => signIn("discord", { callbackUrl: "/settings/account" })}
            className="rounded-[8px] border border-neutral-700 px-3 py-1.5 text-[13px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--gcs-hover)]"
          >
            {t("connect")}
          </button>
        </div>
      )}

      {linked && !joined && (
        <div className="flex flex-col items-start gap-2 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface-2)] px-4 py-3">
          <p className="text-[13px] text-[var(--gcs-text-dim)]">{t("notJoined")}</p>
          <div className="flex gap-2">
            {inviteUrl && (
              <a
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-[8px] border border-neutral-700 px-3 py-1.5 text-[13px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--gcs-hover)]"
              >
                {t("join")}
              </a>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium text-[var(--gcs-text-dim)] transition-colors hover:bg-[var(--gcs-hover)] disabled:opacity-60"
            >
              {refreshing ? t("refreshing") : t("refresh")}
            </button>
          </div>
        </div>
      )}

      {eligible && (
        <div className="flex flex-col gap-3">
          {EMAIL_CATEGORIES.map((category) => (
            <div key={category} className="flex items-center gap-2.5">
              <span className="text-[13.5px] font-medium text-[var(--gcs-text-dim)]">{t(`category.${category}`)}</span>
              <button
                type="button"
                onClick={() => toggle(category)}
                aria-pressed={prefs[category]}
                className="relative ml-auto h-[23px] w-10 flex-none rounded-full transition-colors"
                style={{ background: prefs[category] ? "#e4ae22" : "var(--gcs-hover-2)" }}
              >
                <span
                  className="absolute top-[3px] h-[17px] w-[17px] rounded-full bg-neutral-50 transition-[left]"
                  style={{ left: prefs[category] ? "20px" : "3px" }}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[#e08585]">
          {error}
        </p>
      )}
      {status && <p className="mt-3 text-[13px] text-[#7cc48a]">{status}</p>}
    </SettingsCard>
  );
}
