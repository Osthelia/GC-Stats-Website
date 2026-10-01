/**
 * GC-Stats - organization-streams-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import type { OrganizationStreamChannel } from "@/lib/organization-page-data";
import { TwitchIcon, YoutubeIcon, TiktokIcon, WebsiteIcon } from "@/components/icons/brand-icons";

const PLATFORM_ICONS: Record<string, (props: { className?: string }) => React.ReactNode> = {
  twitch: TwitchIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
};

export async function OrganizationStreamsPanel({ channels }: { channels: OrganizationStreamChannel[] }) {
  const t = await getTranslations("organizationPage");

  return (
    <div>
      <h2 className="mb-3 text-[13px] font-extrabold tracking-[0.13em] text-neutral-50 uppercase">{t("streamChannels")}</h2>

      {channels.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noStreamChannels")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {channels.map((c) => {
            const Icon = PLATFORM_ICONS[c.platform] ?? WebsiteIcon;
            return (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)] p-3 transition-colors hover:border-neutral-700"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/[0.06]">
                  <Icon className="h-4 w-4 text-neutral-300" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-[var(--gcs-text)]">{c.name}</span>
                  <span className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">{c.platform} · {c.type === "watchparty" ? t("streamTypeWatchparty") : t("streamTypeOfficial")} · {c.languageCode}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
