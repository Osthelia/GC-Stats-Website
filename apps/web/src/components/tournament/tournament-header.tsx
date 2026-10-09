/**
 * GC-Stats - tournament-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GOLD, tint } from "@/lib/theme-colors";
import { REGIONS, normalizeRegion } from "@/lib/tournament-regions";
import { DEFAULT_TOURNAMENT_LOGO } from "@/lib/default-logos";
import {
  getPublicTournamentStageLinks,
  type TournamentHeaderInfo,
} from "@/lib/tournament-bracket-data";
import { OrgBadge } from "@/components/organization/org-badge";
import { LiquipediaLinkPill } from "@/components/tournament/liquipedia-link-pill";
import {
  DiscordIcon,
  TwitchIcon,
  XIcon,
  InstagramIcon,
  YoutubeIcon,
  TiktokIcon,
  WebsiteIcon,
  SOCIAL_BRAND_COLORS,
} from "@/components/icons/brand-icons";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";
import { HeaderUtilityBar } from "@/components/site/header-utility-bar";
import { AdminPanelLink } from "@/components/site/admin-panel-link";
import { ShareMenuButton } from "@/components/site/share-menu-button";
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

// tournaments.start_date/end_date are calendar dates, not instants (no time
// component) — <FormattedDate> is timezone-aware and would risk shifting
// the displayed day, same reasoning already applied to finance-ledger.tsx
// and point-types-panel.tsx. Format directly, no `timeZone` option.
function formatCalendarDate(locale: string, value: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-7-6.1-7-11.5A7 7 0 0119 9.5C19 14.9 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.66 2.69 3 6 3s6-1.34 6-3V7" />
      <path d="M3 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      <path d="M15 8.6c2.9.35 5 1.55 5 2.9s-2.1 2.55-5 2.9M15 14.6c2.9.35 5 1.55 5 2.9s-2.1 2.55-5 2.9" />
    </svg>
  );
}

const TABS = [
  "overview",
  "matches",
  "pickem",
  "stats",
  "maps",
  "production",
] as const;

export async function TournamentHeader({
  tournament,
  basePath,
  activeTab,
}: {
  tournament: TournamentHeaderInfo;
  basePath: string;
  activeTab: (typeof TABS)[number];
}) {
  const [t, tNav, tShare, locale, isAdmin, stageLinks] = await Promise.all([
    getTranslations("tournamentPage"),
    getTranslations("nav"),
    getTranslations("share"),
    getLocale(),
    isViewerAdmin(),
    getPublicTournamentStageLinks(tournament.id),
  ]);
  const regionMeta = REGIONS[normalizeRegion(tournament.region)];

  const tabHrefs: Record<(typeof TABS)[number], string> = {
    overview: `/tournaments/${basePath}`,
    matches: `/tournaments/${basePath}/matches`,
    pickem: `/tournaments/${basePath}/pickem`,
    stats: `/tournaments/${basePath}/stats`,
    maps: `/tournaments/${basePath}/maps`,
    production: `/tournaments/${basePath}/production`,
  };
  const tabLabels: Record<(typeof TABS)[number], string> = {
    overview: t("tabOverview"),
    matches: t("tabMatches"),
    pickem: t("tabPickem"),
    stats: t("tabStats"),
    maps: t("tabMaps"),
    production: t("tabProduction"),
  };

  const facts: {
    key: string;
    icon: (props: { className?: string }) => React.ReactNode;
    label: string;
    value: string;
  }[] = [
    {
      key: "dates",
      icon: CalendarIcon,
      label: t("factDates"),
      value: `${formatCalendarDate(locale, tournament.startDate)} → ${formatCalendarDate(locale, tournament.endDate)}`,
    },
  ];
  if (tournament.location)
    facts.push({
      key: "location",
      icon: PinIcon,
      label: t("factLocation"),
      value: tournament.location,
    });
  if (tournament.prizePool)
    facts.push({
      key: "prizePool",
      icon: CoinsIcon,
      label: t("factPrizePool"),
      value: tournament.prizePool,
    });

  const socialLinks: {
    key: string;
    label: string;
    icon: (props: { className?: string }) => React.ReactNode;
    href: string;
  }[] = [];
  if (tournament.socials.website)
    socialLinks.push({
      key: "website",
      label: t("website"),
      icon: WebsiteIcon,
      href: tournament.socials.website,
    });
  for (const [key, url] of Object.entries(tournament.socials)) {
    if (key === "website" || !url) continue;
    const Icon = SOCIAL_ICONS[key];
    if (!Icon) continue;
    socialLinks.push({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      icon: Icon,
      href: url,
    });
  }

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
        <ShareMenuButton items={[{ href: `/tournaments/${basePath}/liquipedia`, label: tShare("tournamentWikicode"), icon: "tournament" }]} calendarPath={`/api/calendar/tournament/${tournament.id}.ics`} />
        {isAdmin && (
          <AdminPanelLink
            href={`/admin/tournaments/${tournament.id}`}
            label={tNav("adminPanel")}
          />
        )}
      </HeaderUtilityBar>

      <div className="relative mx-auto max-w-[1400px] px-6 pt-14 md:pt-9">
        {/* Fixed bottom padding on the row itself (not a child's margin) — a
            row with no description/tagline must still leave the same gap
            before the tabs, otherwise the tab bar rides up flush against
            the logo. Mirrors TeamHeader/PlayerHeader/OrganizationHeader. */}
        <div className="flex flex-wrap items-start gap-6 pb-7">
          <div
            className="flex h-[118px] w-[118px] flex-none items-center justify-center rounded-2xl border border-neutral-800 p-3"
            style={{
              background: "var(--gcs-surface-2)",
              boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
            }}
          >
            <ThemedLogoImage
              dark={tournament.logoUrl || DEFAULT_TOURNAMENT_LOGO}
              light={
                tournament.logoUrlLight ||
                tournament.logoUrl ||
                DEFAULT_TOURNAMENT_LOGO
              }
              alt={tournament.name}
              width={84}
              height={84}
              className="h-full w-full object-contain"
            />
          </div>

          <div className="flex min-w-[300px] flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="rounded-md border px-2 py-1 font-mono text-[11px] font-bold tracking-[0.14em]"
                style={{
                  color: regionMeta.color,
                  background: tint(regionMeta.color, 0.14),
                  borderColor: tint(regionMeta.color, 0.35),
                }}
              >
                {regionMeta.label}
              </span>
              {tournament.category && (
                <span className="rounded-md border border-neutral-700 bg-white/5 px-2 py-1 text-[11px] font-semibold tracking-[0.08em] text-neutral-300 uppercase">
                  {tournament.category}
                </span>
              )}
              {tournament.status === "live" ? (
                <span className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-[10.5px] font-black tracking-wide text-red-400">
                    {t("statusLive")}
                  </span>
                </span>
              ) : (
                <span className="rounded-md border border-neutral-800 bg-white/5 px-2 py-1 font-mono text-[10px] font-bold tracking-[0.1em] text-neutral-500 uppercase">
                  {tournament.status === "finished"
                    ? t("statusFinished")
                    : t("statusUpcoming")}
                </span>
              )}
            </div>

            <h1 className="text-[38px] leading-tight font-black tracking-tight text-[var(--gcs-text)]">
              {tournament.name}
            </h1>

            {tournament.description && (
              <p className="max-w-[620px] text-[14.5px] leading-relaxed text-neutral-400">
                {tournament.description}
              </p>
            )}

            {(tournament.liquipediaLink ||
              stageLinks.length > 0 ||
              socialLinks.length > 0) && (
              <div className="flex flex-wrap gap-2 pb-1 pt-1">
                {tournament.liquipediaLink && (
                  <LiquipediaLinkPill
                    href={tournament.liquipediaLink}
                    label={t("liquipedia")}
                  />
                )}
                {stageLinks.map((s) => (
                  <LiquipediaLinkPill
                    key={s.name}
                    href={s.liquipediaLink}
                    label={s.name}
                  />
                ))}
                {socialLinks.map((l) => {
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
            )}
          </div>

          <div className="flex w-full flex-none flex-col gap-2 sm:w-[300px]">
            <span className="font-mono text-[10px] tracking-[0.12em] text-neutral-500 uppercase">
              {t("quickFacts")}
            </span>
            <div
              className="flex flex-col divide-y divide-neutral-800 rounded-lg border border-neutral-800"
              style={{ background: "var(--gcs-surface-2)" }}
            >
              {facts.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.key}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <Icon className="h-3.5 w-3.5 flex-none" />
                      {f.label}
                    </span>
                    <span className="truncate text-right text-[12.5px] font-semibold text-neutral-100">
                      {f.value}
                    </span>
                  </div>
                );
              })}
              {tournament.organizer && (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-xs text-neutral-500">{t("factOrganizer")}</span>
                  <Link
                    href={`/organization/${tournament.organizer.id}/${tournament.organizer.slug}`}
                    className="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold text-neutral-100 transition-colors hover:text-[#e4ae22] active:scale-[0.97]"
                  >
                    <OrgBadge name={tournament.organizer.name} logoUrl={tournament.organizer.logoUrl} logoUrlLight={tournament.organizer.logoUrlLight} size={22} />
                    <span className="truncate">{tournament.organizer.name}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <EntityTabBar
          tabs={TABS.map((tab) => ({
            key: tab,
            href: tabHrefs[tab],
            label: tabLabels[tab],
          }))}
          activeKey={activeTab}
        />
      </div>
    </div>
  );
}
