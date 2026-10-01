/**
 * GC-Stats — layout
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import Script from "next/script";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { routing, rtlLocales, type AppLocale } from "@/i18n/routing";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SiteSettingsProvider, THEME_INIT_SCRIPT } from "@/lib/site-settings";
import { PageViewTracker } from "@/components/page-view-tracker";
import "../globals.css";
import "flag-icons/css/flag-icons.min.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "home" });
  return {
    title: { default: t("title"), template: `%s - ${t("title")}` },
    description: t("subtitle"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Static rendering per-locale instead of bailing into dynamic — see
  // next-intl's static rendering docs.
  setRequestLocale(locale);

  // admin/dashboard messages are provided by their own layouts, keeps them out of every public page payload.
  const { admin: _admin, dashboard: _dashboard, ...clientMessages } = await getMessages();

  return (
    <html lang={locale} dir={rtlLocales.includes(locale) ? "rtl" : "ltr"} className={`dark ${instrumentSans.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-[var(--gcs-bg)] font-[family-name:var(--font-body)] text-[15px] text-[var(--gcs-text)] antialiased">
        {/* Sets data-site-theme before first paint so the light theme (if
            stored) doesn't flash dark first — see THEME_INIT_SCRIPT.
            next/script (not a bare <script>): a bare script tag re-creates
            its DOM node (and logs React's "script tag" dev warning) any
            time this root layout re-renders client-side, e.g. on
            router.refresh() from an unrelated page far down the tree —
            next/script's beforeInteractive strategy runs it once per
            document load and is exempt from that reconciliation. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <NextIntlClientProvider messages={clientMessages}>
          {/* Client-side session cache used by useSession() in SiteHeader (and
              any future client component) — a server component can't call
              that hook, so this has to wrap everything below it. */}
          <SessionProvider>
            <SiteSettingsProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </SiteSettingsProvider>
          </SessionProvider>
          <Toaster />
          <PageViewTracker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
