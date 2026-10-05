/**
 * GC-Stats - player-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GOLD, tint } from "@/lib/theme-colors";
import type {
  PlayerPageInfo,
  PlayerAchievement,
  PlayerTabAvailability,
} from "@/lib/player-page-data";
import { CountryBadge, hasCountryFlag } from "@/components/team/country-badge";
import { ordinalPlacement, placementColor } from "@/lib/ordinal";
import { abbreviateTournamentName } from "@/lib/home-data";
import { slugify } from "@/lib/entity-id";
import {
  DiscordIcon,
  TwitchIcon,
  XIcon,
  InstagramIcon,
  YoutubeIcon,
  TiktokIcon,
  SOCIAL_BRAND_COLORS,
} from "@/components/icons/brand-icons";
import { LiquipediaLinkPill } from "@/components/tournament/liquipedia-link-pill";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";
import { HeaderUtilityBar } from "@/components/site/header-utility-bar";
import { AdminPanelLink } from "@/components/site/admin-panel-link";
import { isViewerAdmin } from "@/lib/rbac";
import { EntityTabBar } from "@/components/site/entity-tab-bar";

const SOCIAL_ICONS: Record<
  string,
  (props: { className?: string }) => React.ReactNode
> = {
  twitter: XIcon,
  x: XIcon,
  twitch: TwitchIcon,
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  discord: DiscordIcon,
};

const TABS = ["overview", "matches", "stats", "history", "production"] as const;

/** Rendered once by the tabs layout, the active tab follows the URL. */
export async function PlayerHeader({
  player,
  segment,
  achievements,
  availability,
}: {
  player: PlayerPageInfo;
  segment: string;
  achievements: { items: PlayerAchievement[]; titles: number; podiums: number };
  availability: PlayerTabAvailability;
}) {
  const [t, tNav, isAdmin] = await Promise.all([getTranslations("playerPage"), getTranslations("nav"), isViewerAdmin()]);

  const links: {
    key: string;
    label: string;
    icon: (props: { className?: string }) => React.ReactNode;
    href: string;
  }[] = [];
  for (const [key, url] of Object.entries(player.socials)) {
    if (!url) continue;
    const Icon = SOCIAL_ICONS[key];
    if (!Icon) continue;
    links.push({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      icon: Icon,
      href: url,
    });
  }

  const tabHrefs: Record<(typeof TABS)[number], string> = {
    overview: `/player/${segment}`,
    matches: `/player/${segment}/matches`,
    stats: `/player/${segment}/stats`,
    history: `/player/${segment}/history`,
    production: `/player/${segment}/production`,
  };
  const tabLabels: Record<(typeof TABS)[number], string> = {
    overview: t("tabOverview"),
    matches: t("tabMatches"),
    stats: t("tabStats"),
    history: t("tabTeamsHistory"),
    production: t("tabProduction"),
  };

  // A tab only shows up once the person actually has something behind it
  // (explicit request) — except the tab currently open, always kept so a
  // direct/shared link to a since-emptied tab doesn't strand the visitor
  // with no way to tell which page they're on.
  const tabAvailable: Record<(typeof TABS)[number], boolean> = {
    overview: true,
    matches: availability.hasMatches,
    stats: availability.hasMatches,
    history: availability.hasTeamHistory,
    production: availability.hasProduction,
  };

  return (
    <div
      className="gcs-profile-header relative overflow-hidden border-b border-neutral-800"
      style={{ background: "var(--gcs-surface-3)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(560px 320px at 12% 8%, ${tint(GOLD, 0.16)}, transparent 65%)`,
        }}
      />

      <HeaderUtilityBar>
        {isAdmin && (
          <AdminPanelLink
            href={`/admin/players/${player.id}`}
            label={tNav("adminPanel")}
          />
        )}
        <Link
          href={`/player/${segment}/suggest-edit`}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5c4c22] hover:text-[#e4ae22] active:scale-[0.97]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {t("suggestEdit")}
        </Link>
      </HeaderUtilityBar>

      <div className="relative mx-auto max-w-[1400px] px-6 pt-9">
        {/* Fixed bottom padding on the row itself (not a child's margin) — a
            row with no bio/socials must still leave the same gap before the
            tabs, otherwise the tab bar rides up flush against the avatar. */}
        <div className="flex flex-wrap items-start gap-6 pb-7">
          <div
            className="flex h-[118px] w-[118px] flex-none items-center justify-center rounded-2xl border border-neutral-800"
            style={{
              background: "var(--gcs-surface-2)",
              boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
            }}
          >
            {player.logoUrl || player.logoUrlLight ? (
              <ThemedLogoImage
                dark={player.logoUrl ?? player.logoUrlLight!}
                light={player.logoUrlLight ?? player.logoUrl!}
                alt={player.handle}
                width={84}
                height={84}
                className="h-[84px] w-[84px] rounded-xl object-contain"
              />
            ) : (
              <span className="text-[40px] font-black text-neutral-600">
                {player.handle.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex min-w-[300px] flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {(hasCountryFlag(player.countryCode) ||
                hasCountryFlag(player.secondaryCountryCode)) && (
                <CountryBadge
                  code={player.countryCode}
                  secondaryCode={player.secondaryCountryCode}
                  size={26}
                />
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[46px] leading-none font-black tracking-tight text-[var(--gcs-text)]">
                  {player.handle}
                </h1>
                {!player.isActive && (
                  <span className="text-xs font-medium text-neutral-500">
                    {t("inactive")}
                  </span>
                )}
              </div>
              {(player.firstName || player.lastName) && (
                <p className="text-[15px] font-medium text-neutral-400">
                  {[player.firstName, player.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              )}
            </div>

            {player.bio && (
              <p className="max-w-[620px] text-[14.5px] leading-relaxed text-neutral-400">
                {player.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pb-1 pt-1">
              {player.liquipediaLink && (
                <LiquipediaLinkPill
                  href={player.liquipediaLink}
                  label={t("liquipedia")}
                />
              )}
              {links.map((l) => {
                const Icon = l.icon;
                return (
                  <a
                    key={l.key}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={
                      {
                        "--brand": SOCIAL_BRAND_COLORS[l.key] ?? "#e4ae22",
                      } as React.CSSProperties
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:text-[var(--brand)] active:scale-[0.97]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {l.label}
                  </a>
                );
              })}
            </div>
          </div>

          <div className="flex w-full flex-none flex-col gap-2 sm:w-[300px]">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] tracking-[0.12em] text-neutral-500 uppercase">
                {t("achievements")}
              </span>
              {achievements.items.length > 0 && (
                <span className="font-mono text-[10px] text-neutral-600">
                  {achievements.titles} {t("titles").toLowerCase()} ·{" "}
                  {achievements.podiums} {t("podiums").toLowerCase()}
                </span>
              )}
            </div>

            {achievements.items.length === 0 ? (
              <div
                className="rounded-lg border border-neutral-800 px-3 py-2.5 text-xs text-neutral-500"
                style={{ background: "var(--gcs-surface-2)" }}
              >
                {t("noTitle")}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {achievements.items.map((a) => {
                  const color = placementColor(a.placement);
                  return (
                    <Link
                      key={a.qualificationId}
                      href={`/tournaments/${a.tournamentId}/${slugify(a.tournamentName)}`}
                      className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{
                        borderColor: tint(color, 0.35),
                        background: tint(color, 0.12),
                      }}
                    >
                      <span
                        className="w-7 flex-none font-mono text-[10px] font-black"
                        style={{ color }}
                      >
                        {ordinalPlacement(a.placement)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-neutral-100">
                        {abbreviateTournamentName(a.tournamentName)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <EntityTabBar
          tabs={TABS.map((tab) => ({
            key: tab,
            href: tabHrefs[tab],
            label: tabLabels[tab],
            hideUnlessActive: !tabAvailable[tab],
          }))}
        />
      </div>
    </div>
  );
}
