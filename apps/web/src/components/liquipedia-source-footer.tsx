/**
 * GC-Stats - liquipedia-source-footer
 *
 * Attribution shown at the bottom of a page when some of its data was imported
 * from Liquipedia (CC BY-SA 3.0 asks for the source and a link to it).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";

export async function LiquipediaSourceFooter({ sourced, href }: { sourced: boolean; href: string | null }) {
  if (!sourced || !href) return null;
  const t = await getTranslations("liquipediaSource");
  return (
    <p className="mx-auto mt-10 max-w-7xl px-4 pb-10 text-center text-xs text-neutral-500">
      {t("text")}{" "}
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-neutral-400 underline-offset-2 transition-colors hover:text-[#e4ae22] hover:underline active:opacity-70">
        {t("link")}
      </a>
    </p>
  );
}
