/**
 * GC-Stats - site-header
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, localeDisplay, type AppLocale } from "@/i18n/routing";
import { TIMEZONES } from "@/lib/timezones";
import { HeaderAuthStatus } from "@/components/header-auth-status";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearch } from "@/components/search/global-search";
import {
  KNOWN_ACCENTS,
  useSiteSettings,
  type SiteAccent,
  type SiteTheme,
} from "@/lib/site-settings";
import { defaultNewsLanguages } from "@/lib/news-languages-default";
import { stripAccents } from "@/lib/search-typo";
import { GcStatsWordmark } from "@/components/site/gc-stats-wordmark";

const NAV_ITEMS = ["matches", "tournaments"] as const;

const NAV_HREFS: Record<(typeof NAV_ITEMS)[number], string> = {
  matches: "/match",
  tournaments: "/tournaments",
};

export function SiteHeader({
  isAdmin,
  isDashboard,
  newsLanguageOptions,
}: {
  isAdmin: boolean;
  isDashboard: boolean;
  newsLanguageOptions: { code: string; name: string }[];
}) {
  const t = useTranslations("nav");
  const tSettings = useTranslations("settings");
  const pathname = usePathname();
  const { status: sessionStatus } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<
    "menu" | "settings" | "timezone" | "language" | "newsLanguages"
  >("menu");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = () => {
      setSettingsOpen(false);
      setLangOpen(false);
    };
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, []);

  // Closing the mobile drawer on navigation avoids it staying open behind
  // the next page (next-intl's Link doesn't unmount this component).
  useEffect(() => {
    setMobileOpen(false);
    setMobilePanel("menu");
  }, [pathname]);

  const navLinks = (
    <>
      <Link
        href="/"
        className={
          pathname === "/"
            ? "text-[14.5px] font-semibold text-neutral-50"
            : "text-[14.5px] font-medium text-neutral-500 hover:text-neutral-50"
        }
      >
        {t("home")}
      </Link>
      {NAV_ITEMS.map((item) => {
        const href = NAV_HREFS[item];
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={item}
            href={href}
            className={
              active
                ? "text-[14.5px] font-semibold text-neutral-50"
                : "text-[14.5px] font-medium text-neutral-500 hover:text-neutral-50"
            }
          >
            {t(item)}
          </Link>
        );
      })}
    </>
  );

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-[60] border-b border-neutral-800 bg-[var(--gcs-bg)]/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-[62px] max-w-[1400px] items-center gap-3 px-3 sm:h-[66px] sm:gap-5 sm:px-6 md:gap-9">
        <Link href="/" className="flex flex-none items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#e4ae22] text-[13px] font-bold tracking-tight text-[#0e0e0e]">
            GC
          </div>
          <GcStatsWordmark className="hidden text-[17px] font-bold tracking-tight text-neutral-50 sm:block" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">{navLinks}</nav>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-2.5 md:flex">
          <GlobalSearch />

          <div className="relative flex-none">
            <button
              type="button"
              title="Settings"
              onClick={(e) => {
                e.stopPropagation();
                setSettingsOpen((v) => !v);
                setLangOpen(false);
              }}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border transition-colors"
              style={{
                background: settingsOpen
                  ? "var(--gcs-hover)"
                  : "var(--gcs-surface)",
                borderColor: settingsOpen
                  ? "var(--gcs-hover-2)"
                  : "var(--gcs-border)",
                color: settingsOpen ? "#e4ae22" : "var(--gcs-text-secondary)",
              }}
            >
              <SettingsGearIcon />
            </button>
            {settingsOpen && (
              <SettingsPanel newsLanguageOptions={newsLanguageOptions} />
            )}
          </div>

          <LanguageSwitcher open={langOpen} onToggle={setLangOpen} />

          <NotificationBell />

          <HeaderAuthStatus isAdmin={isAdmin} isDashboard={isDashboard} />
        </div>

        <div className="ml-auto flex flex-none items-center gap-2 md:hidden">
          <NotificationBell />
          <HeaderAuthStatus
            isAdmin={isAdmin}
            isDashboard={isDashboard}
            compact
          />
          <button
            type="button"
            aria-label={t("menu")}
            aria-expanded={mobileOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMobileOpen((v) => !v);
              setMobilePanel("menu");
            }}
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface)] text-neutral-300 transition-colors active:scale-[0.95]"
          >
            {mobileOpen ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-h-[calc(100vh-62px)] overflow-y-auto border-t border-neutral-800 bg-[var(--gcs-bg)] px-4 py-4 sm:max-h-[calc(100vh-66px)] md:hidden"
        >
          {mobilePanel === "menu" && (
            <>
              <div className="mb-4">
                <GlobalSearch />
              </div>

              <nav className="mb-2 flex flex-col gap-0.5">
                {NAV_ITEMS_WITH_HOME.map(({ key, href }) => (
                  <Link
                    key={key}
                    href={href}
                    className="rounded-lg px-2.5 py-2.5 text-[15px] font-semibold transition-colors"
                    style={{
                      color:
                        pathname === href ||
                        (href !== "/" && pathname.startsWith(`${href}/`))
                          ? "#e4ae22"
                          : "var(--gcs-text)",
                    }}
                  >
                    {t(key)}
                  </Link>
                ))}
              </nav>

              <div className="border-t border-neutral-800 pt-2">
                <MobileDrawerRow
                  icon={<SettingsGearIcon />}
                  label={tSettings("title")}
                  onClick={() => setMobilePanel("settings")}
                />
              </div>

              {sessionStatus === "unauthenticated" && (
                <div className="mt-2 flex gap-2 border-t border-neutral-800 pt-3">
                  <Link
                    href="/login"
                    className="flex h-[40px] flex-1 items-center justify-center rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface)] text-sm font-semibold text-neutral-100 transition-colors hover:bg-[var(--gcs-hover)] active:scale-[0.98]"
                  >
                    {t("login")}
                  </Link>
                  <Link
                    href="/register"
                    className="flex h-[40px] flex-1 items-center justify-center rounded-[10px] bg-[#e4ae22] text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:scale-[0.98]"
                  >
                    {t("register")}
                  </Link>
                </div>
              )}
            </>
          )}

          {mobilePanel === "settings" && (
            <MobileSettingsPanel
              onBack={() => setMobilePanel("menu")}
              onOpenTimezone={() => setMobilePanel("timezone")}
              onOpenLanguage={() => setMobilePanel("language")}
              onOpenNewsLanguages={() => setMobilePanel("newsLanguages")}
              newsLanguageOptions={newsLanguageOptions}
            />
          )}

          {mobilePanel === "timezone" && (
            <MobileTimezonePanel onBack={() => setMobilePanel("settings")} />
          )}

          {mobilePanel === "newsLanguages" && (
            <MobileNewsLanguagesPanel
              options={newsLanguageOptions}
              onBack={() => setMobilePanel("settings")}
            />
          )}

          {mobilePanel === "language" && (
            <MobileLanguagePanel onBack={() => setMobilePanel("settings")} />
          )}
        </div>
      )}
    </header>
  );
}

function SettingsGearIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.08A1.7 1.7 0 009 19.32a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.03H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6h.08A1.7 1.7 0 0010.1 3.04V3a2 2 0 114 0v.09a1.7 1.7 0 001.03 1.56 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9v.08a1.7 1.7 0 001.56 1.03H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51 1.03z" />
    </svg>
  );
}

const NAV_ITEMS_WITH_HOME: {
  key: "home" | (typeof NAV_ITEMS)[number];
  href: string;
}[] = [
  { key: "home", href: "/" },
  ...NAV_ITEMS.map((item) => ({ key: item, href: NAV_HREFS[item] })),
];

function MobileLanguageList() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-0.5">
      {routing.locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => router.replace(pathname, { locale: code })}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm"
            style={{
              background: active ? "var(--gcs-hover)" : "transparent",
              color: active ? "#e4ae22" : "var(--gcs-text-dim)",
              fontWeight: active ? 600 : 500,
            }}
          >
            <span className="text-base leading-none">
              {localeDisplay[code].flag}
            </span>
            <span>{localeDisplay[code].name}</span>
          </button>
        );
      })}
    </div>
  );
}

function MobileDrawerHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--gcs-text-secondary)] transition-colors hover:bg-[var(--gcs-hover)]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <h3 className="text-[15px] font-semibold text-[var(--gcs-text)]">
        {title}
      </h3>
    </div>
  );
}

function MobileDrawerRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-3 text-left text-[15px] font-medium text-[var(--gcs-text)] transition-colors hover:bg-[var(--gcs-hover)]"
    >
      {icon && (
        <span className="flex-none text-[var(--gcs-text-secondary)]">
          {icon}
        </span>
      )}
      <span className="flex-1">{label}</span>
      {value && (
        <span className="text-sm text-[var(--gcs-text-tertiary)]">{value}</span>
      )}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--gcs-text-tertiary)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-none"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** Mobile drawer "Paramètres" sub-screen — theme/accent/clock24 inline, timezone/language drill into their own sub-screens (too long a list to show inline on a phone). */
function MobileSettingsPanel({
  onBack,
  onOpenTimezone,
  onOpenLanguage,
  onOpenNewsLanguages,
  newsLanguageOptions,
}: {
  onBack: () => void;
  onOpenTimezone: () => void;
  onOpenLanguage: () => void;
  onOpenNewsLanguages: () => void;
  newsLanguageOptions: { code: string; name: string }[];
}) {
  const t = useTranslations("settings");
  const locale = useLocale() as AppLocale;
  const {
    theme,
    setTheme,
    timezone,
    clock24,
    setClock24,
    accents,
    toggleAccent,
  } = useSiteSettings();
  const { summary: newsLanguagesSummary } =
    useNewsLanguages(newsLanguageOptions);

  const themeLabels: Record<SiteTheme, string> = {
    dark: t("themeDark"),
    light: t("themeLight"),
  };
  const accentLabels: Record<SiteAccent, string> = { pride: t("accentPride") };
  const accentSwatches: Record<SiteAccent, string> = {
    pride:
      "linear-gradient(90deg, #e40303, #ff8c00, #ffed00, #008026, #004dff, #750787)",
  };
  const currentOffset =
    TIMEZONES.find((z) => z.id === timezone)?.offset ?? TIMEZONES[0]!.offset;

  return (
    <div>
      <MobileDrawerHeader title={t("title")} onBack={onBack} />

      <div className="mb-2 text-xs font-semibold text-[var(--gcs-text-tertiary)]">
        {t("theme")}
      </div>
      <div className="mb-4 flex gap-1 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface-2)] p-[3px]">
        {(["dark", "light"] as const).map((opt) => {
          const on = theme === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setTheme(opt)}
              className="flex-1 rounded-[7px] py-1.5 text-[13px] transition-colors"
              style={{
                background: on ? "var(--gcs-hover-2)" : "transparent",
                color: on ? "var(--gcs-text)" : "var(--gcs-text-secondary)",
                fontWeight: on ? 600 : 500,
              }}
            >
              {themeLabels[opt]}
            </button>
          );
        })}
      </div>

      <div className="mb-2 text-xs font-semibold text-[var(--gcs-text-tertiary)]">
        {t("accent")}
      </div>
      <div className="mb-2 flex flex-col gap-1">
        {KNOWN_ACCENTS.map((accent) => {
          const on = accents.includes(accent);
          return (
            <button
              key={accent}
              type="button"
              onClick={() => toggleAccent(accent)}
              className="flex w-full items-center gap-2.5 rounded-[9px] border px-2.5 py-2 text-left text-[13px] transition-colors"
              style={{
                borderColor: on ? "var(--gcs-hover-2)" : "var(--gcs-border)",
                background: on ? "var(--gcs-surface-2)" : "transparent",
                color: on ? "var(--gcs-text)" : "var(--gcs-text-secondary)",
                fontWeight: on ? 600 : 500,
              }}
            >
              <span
                className="h-4 w-4 flex-none rounded-full"
                style={{ background: accentSwatches[accent] }}
              />
              {accentLabels[accent]}
              <span
                className="relative ml-auto h-[19px] w-8 flex-none rounded-full transition-colors"
                style={{ background: on ? "#e4ae22" : "var(--gcs-hover-2)" }}
              >
                <span
                  className="absolute top-[2.5px] h-[14px] w-[14px] rounded-full bg-neutral-50 transition-[left]"
                  style={{ left: on ? "15px" : "2.5px" }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-neutral-800 pt-1">
        {newsLanguageOptions.length > 0 && (
          <MobileDrawerRow
            label={t("newsLanguages")}
            value={newsLanguagesSummary}
            onClick={onOpenNewsLanguages}
          />
        )}
        <MobileDrawerRow
          label={t("timezone")}
          value={currentOffset}
          onClick={onOpenTimezone}
        />
        <MobileDrawerRow
          label={t("language")}
          value={localeDisplay[locale].name}
          onClick={onOpenLanguage}
        />
      </div>

      <div className="mt-2 flex items-center gap-2.5 border-t border-neutral-800 px-2.5 pt-3">
        <span className="text-[13px] font-medium text-[var(--gcs-text-dim)]">
          {t("clock24")}
        </span>
        <button
          type="button"
          onClick={() => setClock24(!clock24)}
          className="relative ml-auto h-[23px] w-10 rounded-full transition-colors"
          style={{ background: clock24 ? "#e4ae22" : "var(--gcs-hover-2)" }}
        >
          <span
            className="absolute top-[3px] h-[17px] w-[17px] rounded-full bg-neutral-50 transition-[left]"
            style={{ left: clock24 ? "20px" : "3px" }}
          />
        </button>
      </div>
    </div>
  );
}

function MobileTimezonePanel({ onBack }: { onBack: () => void }) {
  const t = useTranslations("settings");
  const { timezone, setTimezone } = useSiteSettings();
  const [tzQuery, setTzQuery] = useState("");

  const query = stripAccents(tzQuery.trim().toLowerCase());
  const zones = query
    ? TIMEZONES.filter(
        (z) =>
          stripAccents(z.id.replace(/_/g, " ").toLowerCase()).includes(query) ||
          z.offset.includes(query),
      )
    : TIMEZONES;

  return (
    <div>
      <MobileDrawerHeader title={t("timezone")} onBack={onBack} />
      <SettingsSearchField
        value={tzQuery}
        onChange={setTzQuery}
        placeholder={t("searchTimezones")}
        mobile
      />
      <div className="flex flex-col gap-0.5">
        {zones.map((z) => {
          const on = timezone === z.id;
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => setTimezone(z.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[14px]"
              style={{
                background: on ? "var(--gcs-hover)" : "transparent",
                color: on ? "#e4ae22" : "var(--gcs-text-dim)",
                fontWeight: on ? 600 : 500,
              }}
            >
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {z.id.replace(/_/g, " ").replace("/", " / ")}
              </span>
              <span className="flex-none text-xs tabular-nums text-[var(--gcs-text-tertiary)]">
                {z.offset}
              </span>
            </button>
          );
        })}
        {zones.length === 0 && (
          <div className="px-2.5 py-3 text-[13px] text-[var(--gcs-text-tertiary)]">
            {t("noTimezoneFound")}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileNewsLanguagesPanel({
  options,
  onBack,
}: {
  options: { code: string; name: string }[];
  onBack: () => void;
}) {
  const t = useTranslations("settings");
  const [query, setQuery] = useState("");
  const { active, toggle } = useNewsLanguages(options);
  const filtered = filterNewsLanguages(options, query);

  return (
    <div>
      <MobileDrawerHeader title={t("newsLanguages")} onBack={onBack} />
      <SettingsSearchField
        value={query}
        onChange={setQuery}
        placeholder={t("searchNewsLanguages")}
        mobile
      />
      <div className="flex flex-col gap-0.5">
        {filtered.map((option) => {
          const on = active.includes(option.code);
          return (
            <button
              key={option.code}
              type="button"
              onClick={() => toggle(option.code)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[14px]"
              style={{
                background: on ? "var(--gcs-hover)" : "transparent",
                color: on ? "#e4ae22" : "var(--gcs-text-dim)",
                fontWeight: on ? 600 : 500,
              }}
            >
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              <span className="flex-none text-xs uppercase tabular-nums text-[var(--gcs-text-tertiary)]">
                {option.code}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-2.5 py-3 text-[13px] text-[var(--gcs-text-tertiary)]">
            {t("noNewsLanguageFound")}
          </div>
        )}
      </div>
    </div>
  );
}

/** Active news languages (falls back to the locale default) with a toggle that never leaves the list empty. */
function useNewsLanguages(options: { code: string; name: string }[]) {
  const t = useTranslations("settings");
  const locale = useLocale() as AppLocale;
  const { newsLanguages, setNewsLanguages } = useSiteSettings();
  const active =
    newsLanguages && newsLanguages.length > 0
      ? newsLanguages
      : defaultNewsLanguages(locale);

  function toggle(code: string) {
    const next = active.includes(code)
      ? active.filter((l) => l !== code)
      : [...active, code];
    setNewsLanguages(next.length === 0 ? [code] : next);
  }

  const single =
    active.length === 1 ? options.find((o) => o.code === active[0]) : undefined;
  const summary = single
    ? single.name
    : t("newsLanguagesCount", { count: active.length });

  return { active, toggle, summary };
}

function filterNewsLanguages(
  options: { code: string; name: string }[],
  rawQuery: string,
) {
  const query = stripAccents(rawQuery.trim().toLowerCase());
  if (!query) return options;
  return options.filter(
    (o) =>
      stripAccents(o.name.toLowerCase()).includes(query) ||
      o.code.toLowerCase().includes(query),
  );
}

function SettingsSearchField({
  value,
  onChange,
  placeholder,
  mobile = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  mobile?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[9px] border border-neutral-800 bg-[var(--gcs-surface-2)] px-2.5 ${mobile ? "mb-2 h-[38px]" : "mb-1.5 h-[34px]"}`}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--gcs-text-tertiary)"
        strokeWidth="2.3"
        strokeLinecap="round"
        className="flex-none"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.6-3.6" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`min-w-0 flex-1 bg-transparent text-neutral-50 outline-none placeholder:text-[var(--gcs-text-tertiary)] ${mobile ? "text-[14px]" : "text-[13px]"}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex-none text-base leading-none text-[var(--gcs-text-tertiary)] transition-colors hover:text-neutral-50 active:scale-90"
        >
          ×
        </button>
      )}
    </div>
  );
}

function MobileLanguagePanel({ onBack }: { onBack: () => void }) {
  const t = useTranslations("settings");
  return (
    <div>
      <MobileDrawerHeader title={t("language")} onBack={onBack} />
      <MobileLanguageList />
    </div>
  );
}

function LanguageSwitcher({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: (v: boolean) => void;
}) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="relative flex-none">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}
        className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface)] px-2.5 text-neutral-50 hover:bg-[var(--gcs-hover)]"
      >
        <span className="text-base leading-none">
          {localeDisplay[locale].flag}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--gcs-text-tertiary)"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M5 9l7 7 7-7" />
        </svg>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-[46px] z-[70] w-[186px] rounded-xl border border-neutral-800 bg-[var(--gcs-surface-3)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,.7)]"
        >
          {routing.locales.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onToggle(false);
                  router.replace(pathname, { locale: code });
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-[var(--gcs-hover)]"
                style={{
                  background: active ? "var(--gcs-hover)" : undefined,
                  color: active ? "#e4ae22" : "var(--gcs-text-dim)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span className="text-base leading-none">
                  {localeDisplay[code].flag}
                </span>
                <span>{localeDisplay[code].name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  newsLanguageOptions,
}: {
  newsLanguageOptions: { code: string; name: string }[];
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-[46px] z-[70] w-[288px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface-3)] p-3.5 shadow-[0_22px_50px_rgba(0,0,0,.72)]"
    >
      <SettingsPanelContent newsLanguageOptions={newsLanguageOptions} />
    </div>
  );
}

/** Theme/accent/news languages/timezone/clock24 controls, shared by the desktop dropdown (SettingsPanel) and the mobile drawer. */
function SettingsPanelContent({
  newsLanguageOptions,
}: {
  newsLanguageOptions: { code: string; name: string }[];
}) {
  const t = useTranslations("settings");
  const {
    theme,
    setTheme,
    timezone,
    setTimezone,
    clock24,
    setClock24,
    accents,
    toggleAccent,
  } = useSiteSettings();
  const [tzQuery, setTzQuery] = useState("");
  const [newsQuery, setNewsQuery] = useState("");
  const {
    active: activeNewsLanguages,
    toggle: toggleNewsLanguage,
    summary: newsLanguagesSummary,
  } = useNewsLanguages(newsLanguageOptions);
  const filteredNewsLanguages = filterNewsLanguages(
    newsLanguageOptions,
    newsQuery,
  );

  const themeLabels: Record<SiteTheme, string> = {
    dark: t("themeDark"),
    light: t("themeLight"),
  };

  const accentLabels: Record<SiteAccent, string> = {
    pride: t("accentPride"),
  };

  const accentSwatches: Record<SiteAccent, string> = {
    pride:
      "linear-gradient(90deg, #e40303, #ff8c00, #ffed00, #008026, #004dff, #750787)",
  };

  const query = stripAccents(tzQuery.trim().toLowerCase());
  const zones = query
    ? TIMEZONES.filter(
        (z) =>
          stripAccents(z.id.replace(/_/g, " ").toLowerCase()).includes(query) ||
          z.offset.includes(query),
      )
    : TIMEZONES;
  const currentOffset =
    TIMEZONES.find((z) => z.id === timezone)?.offset ?? TIMEZONES[0]!.offset;

  return (
    <>
      <div className="mb-2 text-xs font-semibold text-[var(--gcs-text-tertiary)]">
        {t("theme")}
      </div>
      <div className="mb-4 flex gap-1 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface-2)] p-[3px]">
        {(["dark", "light"] as const).map((opt) => {
          const on = theme === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setTheme(opt)}
              className="flex-1 rounded-[7px] py-1.5 text-[13px] transition-colors hover:bg-[var(--gcs-hover-2)]"
              style={{
                background: on ? "var(--gcs-hover-2)" : undefined,
                color: on ? "var(--gcs-text)" : "var(--gcs-text-secondary)",
                fontWeight: on ? 600 : 500,
              }}
            >
              {themeLabels[opt]}
            </button>
          );
        })}
      </div>

      <div className="mb-2 text-xs font-semibold text-[var(--gcs-text-tertiary)]">
        {t("accent")}
      </div>
      <div className="mb-4 flex flex-col gap-1">
        {KNOWN_ACCENTS.map((accent) => {
          const on = accents.includes(accent);
          return (
            <button
              key={accent}
              type="button"
              onClick={() => toggleAccent(accent)}
              className="flex w-full items-center gap-2.5 rounded-[9px] border px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--gcs-surface-2)]"
              style={{
                borderColor: on ? "var(--gcs-hover-2)" : "var(--gcs-border)",
                background: on ? "var(--gcs-surface-2)" : undefined,
                color: on ? "var(--gcs-text)" : "var(--gcs-text-secondary)",
                fontWeight: on ? 600 : 500,
              }}
            >
              <span
                className="h-4 w-4 flex-none rounded-full"
                style={{ background: accentSwatches[accent] }}
              />
              {accentLabels[accent]}
              <span
                className="relative ml-auto h-[19px] w-8 flex-none rounded-full transition-colors"
                style={{ background: on ? "#e4ae22" : "var(--gcs-hover-2)" }}
              >
                <span
                  className="absolute top-[2.5px] h-[14px] w-[14px] rounded-full bg-neutral-50 transition-[left]"
                  style={{ left: on ? "15px" : "2.5px" }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {newsLanguageOptions.length > 0 && (
        <>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-xs font-semibold text-[var(--gcs-text-tertiary)]">
              {t("newsLanguages")}
            </span>
            <span className="ml-auto text-xs font-medium text-[#e4ae22]">
              {newsLanguagesSummary}
            </span>
          </div>
          <SettingsSearchField
            value={newsQuery}
            onChange={setNewsQuery}
            placeholder={t("searchNewsLanguages")}
          />
          <div className="mb-4 flex max-h-[168px] flex-col gap-0.5 overflow-y-auto">
            {filteredNewsLanguages.map((option) => {
              const on = activeNewsLanguages.includes(option.code);
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => toggleNewsLanguage(option.code)}
                  className="flex w-full flex-none items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--gcs-hover)]"
                  style={{
                    background: on ? "var(--gcs-hover)" : undefined,
                    color: on ? "#e4ae22" : "var(--gcs-text-dim)",
                    fontWeight: on ? 600 : 500,
                  }}
                >
                  <span className="min-w-0 truncate">{option.name}</span>
                  <span className="ml-auto flex-none text-xs uppercase tabular-nums text-[var(--gcs-text-tertiary)]">
                    {option.code}
                  </span>
                </button>
              );
            })}
            {filteredNewsLanguages.length === 0 && (
              <div className="px-2.5 py-3 text-[13px] text-[var(--gcs-text-tertiary)]">
                {t("noNewsLanguageFound")}
              </div>
            )}
          </div>
        </>
      )}

      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-xs font-semibold text-[var(--gcs-text-tertiary)]">
          {t("timezone")}
        </span>
        <span className="ml-auto text-xs font-medium text-[#e4ae22]">
          {currentOffset}
        </span>
      </div>
      <SettingsSearchField
        value={tzQuery}
        onChange={setTzQuery}
        placeholder={t("searchTimezones")}
      />
      <div className="mb-4 flex max-h-[168px] flex-col gap-0.5 overflow-y-auto">
        {zones.map((z) => {
          const on = timezone === z.id;
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => setTimezone(z.id)}
              className="flex w-full flex-none items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--gcs-hover)]"
              style={{
                background: on ? "var(--gcs-hover)" : undefined,
                color: on ? "#e4ae22" : "var(--gcs-text-dim)",
                fontWeight: on ? 600 : 500,
              }}
            >
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {z.id.replace(/_/g, " ").replace("/", " / ")}
              </span>
              <span className="ml-auto flex-none text-xs tabular-nums text-[var(--gcs-text-tertiary)]">
                {z.offset}
              </span>
            </button>
          );
        })}
        {zones.length === 0 && (
          <div className="px-2.5 py-3 text-[13px] text-[var(--gcs-text-tertiary)]">
            {t("noTimezoneFound")}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 border-t border-neutral-800 pt-3">
        <span className="text-[13px] font-medium text-[var(--gcs-text-dim)]">
          {t("clock24")}
        </span>
        <button
          type="button"
          onClick={() => setClock24(!clock24)}
          className="relative ml-auto h-[23px] w-10 rounded-full transition-colors"
          style={{ background: clock24 ? "#e4ae22" : "var(--gcs-hover-2)" }}
        >
          <span
            className="absolute top-[3px] h-[17px] w-[17px] rounded-full bg-neutral-50 transition-[left]"
            style={{ left: clock24 ? "20px" : "3px" }}
          />
        </button>
      </div>
    </>
  );
}
