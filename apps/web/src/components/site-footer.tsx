/**
 * GC-Stats - site-footer
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import packageJson from "../../package.json";
import { GcStatsWordmark } from "@/components/site/gc-stats-wordmark";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DISCORD_INVITE_URL } from "@/lib/discord-invite";

const SOCIALS = [
  {
    name: "X",
    href: "https://x.com/GC_Stats",
    hoverClasses: "hover:border-[#e4ae22] hover:text-[#e4ae22] hover:bg-[#1c1a14] hover:shadow-[0_6px_16px_rgba(228,174,34,.16)]",
    path: "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93zm-1.29 19.49h2.04L6.49 3.24H4.3l13.31 17.4z",
  },
  {
    name: "Discord",
    href: DISCORD_INVITE_URL,
    hoverClasses: "hover:border-[#5865f2] hover:text-[#7f8bff] hover:bg-[#15161f] hover:shadow-[0_6px_16px_rgba(88,101,242,.2)]",
    path: "M20.32 4.37a19.79 19.79 0 00-4.89-1.52.07.07 0 00-.07.04c-.21.37-.45.86-.61 1.25a18.27 18.27 0 00-5.49 0c-.16-.4-.4-.88-.62-1.25a.08.08 0 00-.08-.04 19.74 19.74 0 00-4.88 1.52.07.07 0 00-.04.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 00.03.05 19.9 19.9 0 005.99 3.03.08.08 0 00.09-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 00-.05-.11 13.1 13.1 0 01-1.87-.89.08.08 0 010-.13c.13-.09.25-.19.37-.29a.07.07 0 01.08-.01 14.2 14.2 0 0012.06 0 .07.07 0 01.08.01c.12.1.25.2.37.29a.08.08 0 010 .13c-.6.35-1.22.65-1.87.89a.08.08 0 00-.05.11c.37.69.78 1.36 1.23 1.99a.08.08 0 00.09.03 19.84 19.84 0 006-3.03.08.08 0 00.03-.05c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 00-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z",
  },
  {
    name: "GitHub",
    href: "https://github.com/Osthelia",
    hoverClasses: "hover:border-neutral-500 hover:text-neutral-50 hover:bg-[#1c1c1c] hover:shadow-[0_6px_16px_rgba(255,255,255,.09)]",
    path: "M12 .3a12 12 0 00-3.79 23.4c.6.1.82-.26.82-.58l-.01-2.04c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1-.11-.78.41-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.11-3.17 0 0 1-.33 3.3 1.23a11.5 11.5 0 016 0c2.28-1.56 3.29-1.23 3.29-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.21.69.82.57A12 12 0 0012 .3z",
  },
  {
    name: "Ko-fi",
    href: "https://ko-fi.com/gcstats",
    hoverClasses: "hover:border-[#ff5e5b] hover:text-[#ff7a78] hover:bg-[#1f1616] hover:shadow-[0_6px_16px_rgba(255,94,91,.18)]",
    path: null,
  },
] as const;

export function SiteFooter() {
  const t = useTranslations("footer");

  const columns = [
    {
      title: t("product"),
      links: [
        { label: t("productAllMatches"), href: "/match" },
        { label: t("productTournaments"), href: "/tournaments" },
        { label: t("productDataExplorer"), href: null },
        { label: t("productForum"), href: "/forum" },
      ],
    },
    {
      title: t("contribute"),
      links: [
        { label: t("contributeEditPage"), href: "/help/edit_page" },
        { label: t("contributeAddTournament"), href: "/help/add_tournament" },
        { label: t("contributeBecomePublisher"), href: "/become-publisher" },
        { label: t("contributeWidgets"), href: "/widget" },
      ],
    },
    {
      title: t("aboutTitle"),
      links: [
        { label: t("aboutUs"), href: "/about" },
        { label: t("aboutTransparency"), href: "/transparency" },
        { label: t("aboutDeveloperDocs"), href: "/developers-doc" },
        { label: t("aboutContentRemoval"), href: "/takedown" },
        { label: t("aboutSupportUs"), href: "/support-us" },
      ],
    },
  ];

  return (
    <footer className="border-t border-neutral-800">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 pt-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[#e4ae22] text-[11px] font-bold text-[#0e0e0e]">GC</div>
            <GcStatsWordmark className="text-[15px] font-bold tracking-tight text-neutral-50" />
          </div>
          <p className="max-w-[250px] text-[13.5px] leading-relaxed text-neutral-500">{t("tagline")}</p>
          <div className="mt-[18px] flex flex-wrap gap-2">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                title={s.name}
                target={s.href.startsWith("http") ? "_blank" : undefined}
                rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`flex h-9 w-9 items-center justify-center rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface)] text-[var(--gcs-text-secondary)] transition-all hover:-translate-y-[3px] ${s.hoverClasses}`}
              >
                {s.path ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d={s.path} />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h11v7a4 4 0 01-4 4H8a4 4 0 01-4-4V6z" />
                    <path d="M15 7h1.8a2.7 2.7 0 010 5.4H15" />
                    <path d="M4 20h11" />
                  </svg>
                )}
              </a>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title} className="min-w-0">
            <div className="mb-3.5 text-[13.5px] font-semibold text-neutral-50">{col.title}</div>
            <div className="flex flex-col gap-2.5">
              {col.links.map((l) =>
                l.href === null ? (
                  <Tooltip key={l.label}>
                    <TooltipTrigger
                      type="button"
                      aria-disabled="true"
                      className="w-fit cursor-not-allowed text-left text-[13.5px] text-neutral-700"
                    >
                      {l.label}
                    </TooltipTrigger>
                    <TooltipContent>{t("productDataExplorerComingSoon")}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Link key={l.label} href={l.href} className="text-[13.5px] text-neutral-500 hover:text-[#e4ae22]">
                    {l.label}
                  </Link>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-[1400px] px-6 pb-10 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-5 border-t border-neutral-900 pt-5">
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span>{t("copyright", { year: new Date().getFullYear(), version: packageJson.version })}</span>
            <span className="text-neutral-700">·</span>
            <span className="text-neutral-600">
              {t.rich("madeBy", {
                link: (chunks) => (
                  <a
                    href="https://osthelia.org" target="_blank" rel="noopener noreferrer"
                    className="bg-gradient-to-r from-purple-300 to-purple-300 bg-clip-text text-transparent drop-shadow-[0_0_5px_rgba(192,132,252,0.45)] transition-[filter] hover:drop-shadow-[0_0_10px_rgba(192,132,252,0.8)]"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </span>
          </span>
          <div className="flex flex-wrap gap-5">
            <Link href="/terms" className="text-xs text-neutral-500 hover:text-[#e4ae22]">
              {t("terms")}
            </Link>
            <Link href="/privacy" className="text-xs text-neutral-500 hover:text-[#e4ae22]">
              {t("privacy")}
            </Link>
            <Link href="/legal" className="text-xs text-neutral-500 hover:text-[#e4ae22]">
              {t("legal")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
