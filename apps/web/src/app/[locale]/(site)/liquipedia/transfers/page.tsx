/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { staticTitleMetadata } from "@/lib/page-metadata";
import { LiquipediaTransfersForm } from "@/components/liquipedia/liquipedia-transfers-form";

export const generateMetadata = staticTitleMetadata("liquipediaTransfers.title");

export default function LiquipediaTransfersPage() {
  const t = useTranslations("liquipediaTransfers");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <Link href="/liquipedia" className="text-xs text-neutral-500 transition-colors hover:text-neutral-200 active:opacity-60">
        {t("back")}
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight text-neutral-50">{t("title")}</h1>
      <p className="mt-2 mb-8 text-[14.5px] text-neutral-400">{t("subtitle")}</p>
      <LiquipediaTransfersForm />
    </div>
  );
}
