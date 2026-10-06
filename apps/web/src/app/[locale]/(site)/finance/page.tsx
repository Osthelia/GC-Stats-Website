/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { LegalPageHeader, LegalIntro } from "@/components/legal/ui";
import { FinanceLedger } from "@/components/finance-ledger";
import { getPublicFinanceEntries } from "@/lib/finance-ledger";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("financePage.title");

export default async function FinancePage() {
  const t = await getTranslations("financePage");
  const entries = await getPublicFinanceEntries();

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <FinanceLedger entries={entries} />

      <p className="text-center text-xs text-neutral-500">
        {t("jsonFeedNote")} <a href="/api/finance" className="underline hover:text-neutral-300">/api/finance</a>
      </p>
    </div>
  );
}
