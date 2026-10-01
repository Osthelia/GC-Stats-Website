/**
 * GC-Stats - settings-nav
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const TABS = ["profile", "account", "connections", "notifications", "sanctions", "change-requests"] as const;

export async function SettingsNav({ active }: { active: (typeof TABS)[number] }) {
  const t = await getTranslations("accountSettings");
  const hrefs: Record<(typeof TABS)[number], string> = {
    profile: "/settings/profile",
    account: "/settings/account",
    connections: "/settings/connections",
    notifications: "/settings/notifications",
    sanctions: "/settings/sanctions",
    "change-requests": "/settings/change-requests",
  };
  const labels: Record<(typeof TABS)[number], string> = {
    profile: t("profile.navLabel"),
    account: t("navLabel"),
    connections: t("connectionsNavLabel"),
    notifications: t("notificationsNavLabel"),
    sanctions: t("sanctions.navLabel"),
    "change-requests": t("changeRequestsNavLabel"),
  };

  return (
    <div className="mb-8 flex gap-1 border-b border-neutral-800">
      {TABS.map((tab) => {
        const on = tab === active;
        return (
          <Link
            key={tab}
            href={hrefs[tab]}
            className="relative px-3.5 pb-3 text-[14px] font-semibold transition-colors"
            style={{ color: on ? "var(--gcs-text)" : "var(--gcs-text-secondary)" }}
          >
            {labels[tab]}
            {on && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#e4ae22]" />}
          </Link>
        );
      })}
    </div>
  );
}
