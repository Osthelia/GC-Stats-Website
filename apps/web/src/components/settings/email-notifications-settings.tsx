/**
 * GC-Stats - email-notifications-settings
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateEmailNotificationPreferences } from "@/actions/notification-settings";
import { EMAIL_CATEGORIES, type EmailCategory } from "@/lib/notification-categories";
import { SettingsCard } from "./settings-card";

export function EmailNotificationsSettings({ initialPrefs }: { initialPrefs: Record<EmailCategory, boolean> }) {
  const t = useTranslations("accountSettings.emailNotifications");
  const [prefs, setPrefs] = useState(initialPrefs);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(category: EmailCategory) {
    const next = { ...prefs, [category]: !prefs[category] };
    setPrefs(next);
    setStatus(null);
    setError(null);
    setPending(true);
    const result = await updateEmailNotificationPreferences(next);
    setPending(false);
    if (!result.ok) {
      setPrefs(prefs);
      setError(t("error.invalid"));
      return;
    }
    setStatus(t("saved"));
  }

  return (
    <SettingsCard heading={t("heading")} description={t("description")}>
      <div className="flex flex-col gap-3">
        {EMAIL_CATEGORIES.map((category) => (
          <div key={category} className="flex items-center gap-2.5">
            <span className="text-[13.5px] font-medium text-[var(--gcs-text-dim)]">{t(`category.${category}`)}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(category)}
              aria-pressed={prefs[category]}
              className="relative ml-auto h-[23px] w-10 flex-none rounded-full transition-colors disabled:opacity-60"
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
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[#e08585]">
          {error}
        </p>
      )}
      {status && <p className="mt-3 text-[13px] text-[#7cc48a]">{status}</p>}
    </SettingsCard>
  );
}
