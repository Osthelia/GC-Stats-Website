/**
 * GC-Stats - site-settings
 *
 * Client-side site settings (theme, timezone, clock format, accents, news
 * languages), persisted to localStorage and exposed through a React
 * context. `/admin` always stays dark and ignores these settings.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NEWS_LANGUAGES_COOKIE } from "@/lib/news-languages-cookie";

export type SiteTheme = "dark" | "light";

/** Cosmetic accents, purely visual, stackable (see resources ported from V1's
 * resources/css/accent/*.css). New accents just need an entry here and a
 * matching apps/web/src/app/accents/<slug>.css file. */
export type SiteAccent = "pride";
export const KNOWN_ACCENTS: SiteAccent[] = ["pride"];

export type SiteSettings = {
  theme: SiteTheme;
  timezone: string;
  clock24: boolean;
  accents: SiteAccent[];
  /** null = default rule (site locale + English, see lib/news-languages.ts) — only the header's settings panel writes here. The /news listing page's own filter reads this as its starting point but is otherwise local to that page (URL-only) and never writes back. */
  newsLanguages: string[] | null;
};

const STORAGE_KEY = "gcs-site-settings";

const DEFAULT_SETTINGS: SiteSettings = {
  theme: "dark",
  timezone: "UTC",
  clock24: true,
  accents: [],
  newsLanguages: null,
};

/**
 * Inlined into <body> (see [locale]/layout.tsx) so the theme and accents
 * apply before first paint — without this, the page would flash the
 * defaults (dark theme, no accent) then repaint once React hydrates and
 * reads localStorage.
 */
export const THEME_INIT_SCRIPT = `
try {
  var s = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || "{}");
  if (location.pathname.indexOf("/admin") === -1) {
    if (s.theme === "light") {
      document.documentElement.setAttribute("data-site-theme", "light");
    }
    if (Array.isArray(s.accents) && s.accents.length) {
      document.documentElement.setAttribute("data-accent", s.accents.join(" "));
    }
  }
} catch (e) {}
`;

type SiteSettingsContextValue = SiteSettings & {
  setTheme: (theme: SiteTheme) => void;
  setTimezone: (timezone: string) => void;
  setClock24: (clock24: boolean) => void;
  toggleAccent: (accent: SiteAccent) => void;
  setNewsLanguages: (languages: string[] | null) => void;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

function readStoredSettings(): SiteSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return guessDefaults();
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === "light" ? "light" : "dark",
      timezone: typeof parsed.timezone === "string" && parsed.timezone ? parsed.timezone : guessDefaults().timezone,
      clock24: typeof parsed.clock24 === "boolean" ? parsed.clock24 : true,
      accents: Array.isArray(parsed.accents) ? parsed.accents.filter((a: unknown): a is SiteAccent => KNOWN_ACCENTS.includes(a as SiteAccent)) : [],
      newsLanguages: Array.isArray(parsed.newsLanguages) && parsed.newsLanguages.every((l: unknown) => typeof l === "string") ? parsed.newsLanguages : null,
    };
  } catch {
    return guessDefaults();
  }
}

function guessDefaults(): SiteSettings {
  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
  } catch {
    // Intl unsupported/blocked — keep UTC.
  }
  return { ...DEFAULT_SETTINGS, timezone };
}

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  // Server-rendered value is always the default (dark/UTC/24h) — the real
  // value (localStorage, possibly a different timezone) is only known
  // client-side, applied in this effect right after mount. The anti-flash
  // script above already set data-site-theme synchronously for the theme
  // specifically, so only the state (not the visible dark/light class) jumps.
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const pathname = usePathname();
  // `/admin` keeps its own permanently-dark shadcn theme (see SUIVI.md) and
  // is unaffected by this picker — it must never pick up a "light" choice
  // made on the public site via this shared <html> attribute.
  const isAdminRoute = pathname?.includes("/admin") ?? false;

  useEffect(() => {
    setSettings(readStoredSettings());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-site-theme", isAdminRoute ? "dark" : settings.theme);
  }, [settings.theme, isAdminRoute]);

  // Admin keeps its own shadcn look (see theme effect above) and never
  // picks up a public-site accent via this shared <html> attribute.
  useEffect(() => {
    if (!isAdminRoute && settings.accents.length > 0) {
      document.documentElement.setAttribute("data-accent", settings.accents.join(" "));
    } else {
      document.documentElement.removeAttribute("data-accent");
    }
  }, [settings.accents, isAdminRoute]);

  const persist = useCallback((next: SiteSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode, quota) — setting still applies
      // for this page load via state, just won't survive a reload.
    }
  }, []);

  const setTheme = useCallback((theme: SiteTheme) => persist({ ...settings, theme }), [settings, persist]);
  const setTimezone = useCallback((timezone: string) => persist({ ...settings, timezone }), [settings, persist]);
  const setClock24 = useCallback((clock24: boolean) => persist({ ...settings, clock24 }), [settings, persist]);
  const toggleAccent = useCallback(
    (accent: SiteAccent) => {
      const accents = settings.accents.includes(accent)
        ? settings.accents.filter((a) => a !== accent)
        : [...settings.accents, accent];
      persist({ ...settings, accents });
    },
    [settings, persist],
  );
  const setNewsLanguages = useCallback(
    (newsLanguages: string[] | null) => {
      persist({ ...settings, newsLanguages });
      try {
        document.cookie =
          newsLanguages && newsLanguages.length > 0
            ? `${NEWS_LANGUAGES_COOKIE}=${encodeURIComponent(newsLanguages.join(","))}; path=/; max-age=31536000; samesite=lax`
            : `${NEWS_LANGUAGES_COOKIE}=; path=/; max-age=0`;
      } catch {
        // Cookies blocked — same fail-open as localStorage above, the server just falls back to the default rule.
      }
    },
    [settings, persist],
  );

  return (
    <SiteSettingsContext.Provider value={{ ...settings, setTheme, setTimezone, setClock24, toggleAccent, setNewsLanguages }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): SiteSettingsContextValue {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within a SiteSettingsProvider");
  return ctx;
}
