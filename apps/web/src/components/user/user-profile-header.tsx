/**
 * GC-Stats - user-profile-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GOLD, tint } from "@/lib/home-fake-data";
import { getUserFanTeam, type UserProfileInfo } from "@/lib/user-profile-data";
import { DiscordIcon, TwitchIcon, XIcon, InstagramIcon, YoutubeIcon, TiktokIcon, SOCIAL_BRAND_COLORS } from "@/components/icons/brand-icons";
import { HeaderUtilityBar } from "@/components/site/header-utility-bar";
import { AdminPanelLink } from "@/components/site/admin-panel-link";
import { ReportUserButton } from "@/components/user/report-user-button";
import { UserAvatar } from "@/components/user/user-avatar";
import { UserBadges } from "@/components/user/user-badges";
import { getCurrentUserId } from "@/lib/session";
import { isViewerAdmin } from "@/lib/rbac";

const SOCIAL_ICONS: Record<string, (props: { className?: string }) => React.ReactNode> = {
  twitter: XIcon,
  x: XIcon,
  twitch: TwitchIcon,
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  discord: DiscordIcon,
};

const TABS = ["overview", "news"] as const;

export async function UserProfileHeader({
  user,
  activeTab,
  hasNewsTab,
}: {
  user: UserProfileInfo;
  activeTab: (typeof TABS)[number];
  hasNewsTab: boolean;
}) {
  const t = await getTranslations("userPage");
  const tNav = await getTranslations("nav");
  const [viewerId, isAdmin, fanTeam] = await Promise.all([getCurrentUserId(), isViewerAdmin(), getUserFanTeam(user.id)]);
  const isOwnProfile = viewerId === user.id;

  const links: { key: string; label: string; icon: (props: { className?: string }) => React.ReactNode; href: string }[] = [];
  for (const [key, url] of Object.entries(user.socials)) {
    const Icon = SOCIAL_ICONS[key];
    if (!url || !Icon) continue;
    links.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), icon: Icon, href: url });
  }

  const tabHrefs: Record<(typeof TABS)[number], string> = {
    overview: `/user/${user.username}`,
    news: `/user/${user.username}/news`,
  };
  const tabLabels: Record<(typeof TABS)[number], string> = {
    overview: t("tabOverview"),
    news: t("tabNews"),
  };
  const tabAvailable: Record<(typeof TABS)[number], boolean> = {
    overview: true,
    news: hasNewsTab,
  };
  const visibleTabs = TABS.filter((tab) => tab === activeTab || tabAvailable[tab]);

  const displayName = user.name || user.username;

  return (
    <div className="relative overflow-hidden border-b border-neutral-800" style={{ background: "var(--gcs-surface-3)" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(560px 320px at 12% 8%, ${tint(GOLD, 0.16)}, transparent 65%)` }}
      />

      <HeaderUtilityBar>
        {isAdmin && <AdminPanelLink href={`/admin/users/${user.id}`} label={tNav("adminPanel")} />}
        {isOwnProfile && (
          <Link
            href="/settings/profile"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5c4c22] hover:text-[#e4ae22] active:scale-[0.97]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            {t("editProfile")}
          </Link>
        )}
        <ReportUserButton userId={user.id} canReport={!!viewerId && !isOwnProfile} />
      </HeaderUtilityBar>

      <div className="relative mx-auto max-w-[1400px] px-6 pt-9">
        <div className="flex flex-wrap items-start gap-6 pb-7">
          <div
            className="flex h-[118px] w-[118px] flex-none items-center justify-center overflow-hidden rounded-2xl border border-neutral-800"
            style={{ background: "var(--gcs-surface-2)", boxShadow: "0 16px 36px rgba(0,0,0,0.5)" }}
          >
            <UserAvatar image={user.image} initial={displayName.charAt(0).toUpperCase()} className="h-full w-full object-cover" />
          </div>

          <div className="flex min-w-[300px] flex-1 flex-col gap-3">
            <UserBadges pronouns={user.pronouns} fanTeam={fanTeam} />

            <div className="flex flex-col gap-1">
              <h1 className="text-[46px] leading-none font-black tracking-tight text-[var(--gcs-text)]">{displayName}</h1>
              <p className="text-[15px] font-medium text-neutral-400">@{user.username}</p>
            </div>

            {user.bio && <p className="max-w-[620px] text-[14.5px] leading-relaxed text-neutral-400">{user.bio}</p>}

            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-1 pt-1">
                {links.map((l) => {
                  const Icon = l.icon;
                  return (
                    <a
                      key={l.key}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ "--brand": SOCIAL_BRAND_COLORS[l.key] ?? "#e4ae22" } as React.CSSProperties}
                      className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:text-[var(--brand)] active:scale-[0.97]"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {l.label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end gap-0.5">
          {visibleTabs.map((tab) => {
            const on = tab === activeTab;
            return (
              <Link
                key={tab}
                href={tabHrefs[tab]}
                className="rounded-t-lg px-4 py-2.5 text-[13.5px] transition-colors"
                style={on ? { background: GOLD, color: "#0b0b0c", fontWeight: 700 } : { color: "var(--gcs-text-secondary)", fontWeight: 600 }}
              >
                {tabLabels[tab]}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
