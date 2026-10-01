/**
 * GC-Stats — layout
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";

// Chrome-less layout for standalone broadcast overlay pages (OBS Browser
// Source): no header/footer, transparent background, never indexed. The
// shared app/[locale]/layout.tsx always paints a solid `bg-[var(--gcs-bg)]`
// on <body> for every other route — this style tag is the only way a
// nested layout can override that (same trick as THEME_INIT_SCRIPT there).
const TRANSPARENT_STYLE = `html,body{background:transparent!important;height:100%;margin:0;overflow:hidden}`;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TRANSPARENT_STYLE }} />
      {children}
    </>
  );
}
