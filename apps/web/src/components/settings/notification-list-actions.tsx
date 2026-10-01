/**
 * GC-Stats - notification-list-actions
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { markAllNotificationsRead } from "@/actions/notifications";

export function NotificationListActions() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await markAllNotificationsRead();
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex-none rounded-[9px] border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-2.5 text-[13.5px] font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:text-neutral-50 disabled:opacity-60"
    >
      {pending ? t("markingAllRead") : t("markAllRead")}
    </button>
  );
}
