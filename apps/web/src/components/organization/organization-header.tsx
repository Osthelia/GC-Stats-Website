/**
 * GC-Stats - organization-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GOLD, tint } from "@/lib/theme-colors";
import type { OrganizationPageInfo } from "@/lib/organization-page-data";
import { CountryBadge, hasCountryFlag } from "@/components/team/country-badge";
import { countryNames } from "@/lib/countries";
import {
  DiscordIcon,
  TwitchIcon,
  XIcon,
  InstagramIcon,
  YoutubeIcon,
  TiktokIcon,
  WebsiteIcon,
} from "@/components/icons/brand-icons";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";
import { EntityTabBar } from "@/components/site/entity-tab-bar";
import type { AppLocale } from "@/i18n/routing";

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

const TABS = ["overview", "production", "news"] as const;

export async function OrganizationHeader({
  organization,
  segment,
  activeTab,
  memberCount,
}: {
  organization: OrganizationPageInfo;
  segment: string;
  activeTab: (typeof TABS)[number];
  memberCount: number;
}) {
  const t = await getTranslations("organizationPage");
  const tTags = await getTranslations("organizationPage.tagOptions");
  const locale = await getLocale();

  const links: {
    key: string;
    label: string;
    icon: (props: { className?: string }) => React.ReactNode;
    href: string;
  }[] = [];
  if (organization.socials.website)
    links.push({
      key: "website",
      label: t("website"),
      icon: WebsiteIcon,
      href: organization.socials.website,
    });
  for (const [key, url] of Object.entries(organization.socials)) {
    if (key === "website" || !url) continue;
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
    overview: `/organization/${segment}`,
    production: `/organization/${segment}/production`,
    news: `/organization/${segment}/news`,
  };
  const tabLabels: Record<(typeof TABS)[number], string> = {
    overview: t("tabOverview"),
    production: t("tabProduction"),
    news: t("tabNews"),
  };

  return (
    <div
      className="relative overflow-hidden border-b border-neutral-800"
      style={{ background: "var(--gcs-surface-3)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(560px 320px at 12% 8%, ${tint(GOLD, 0.16)}, transparent 65%)`,
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-6 pt-9">
        <div className="flex flex-wrap items-start gap-6 pb-7">
          <div
            className="flex h-[118px] w-[118px] flex-none items-center justify-center rounded-2xl border border-neutral-800"
            style={{
              background: "var(--gcs-surface-2)",
              boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
            }}
          >
            {organization.logoUrl || organization.logoUrlLight ? (
              <ThemedLogoImage
                dark={organization.logoUrl ?? organization.logoUrlLight!}
                light={organization.logoUrlLight ?? organization.logoUrl!}
                alt={organization.name}
                width={84}
                height={84}
                className="h-[84px] w-[84px] object-contain"
              />
            ) : (
              <span className="text-4xl font-black text-neutral-500">
                {organization.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex min-w-[300px] flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {(hasCountryFlag(organization.countryCode) ||
                hasCountryFlag(organization.secondaryCountryCode)) && (
                <span className="flex items-center gap-1.5 rounded-md border border-neutral-800 bg-white/5 px-2 py-1">
                  <CountryBadge
                    code={organization.countryCode}
                    secondaryCode={organization.secondaryCountryCode}
                    label={countryNames(
                      organization.countryCode,
                      organization.secondaryCountryCode,
                      locale as AppLocale,
                    )}
                  />
                </span>
              )}
              {organization.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border px-2 py-1 font-mono text-[11px] font-bold tracking-[0.1em] uppercase"
                  style={{
                    color: GOLD,
                    background: tint(GOLD, 0.12),
                    borderColor: tint(GOLD, 0.35),
                  }}
                >
                  {tTags.has(tag) ? tTags(tag) : tag}
                </span>
              ))}
            </div>

            <h1 className="text-[46px] leading-none font-black tracking-tight text-[var(--gcs-text)]">
              {organization.name}
            </h1>

            <span className="font-mono text-[11px] tracking-[0.1em] text-neutral-500 uppercase">
              {t("memberCount", { count: memberCount })}
            </span>

            {organization.bio && (
              <p className="max-w-[620px] text-[14.5px] leading-relaxed text-neutral-400">
                {organization.bio}
              </p>
            )}

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
                      className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:border-[#5c4c22] hover:text-[#e4ae22]"
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
