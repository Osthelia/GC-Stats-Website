/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { LegalPageHeader, LegalIntro, InfoBar } from "@/components/legal/ui";
import { FinanceLedger } from "@/components/finance-ledger";
import { getPublicFinanceEntries } from "@/lib/finance-ledger";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("financePage.title");

// Word document explaining our monthly expenses in plain words.
const EXPENSES_DOC_URL = "https://kdrive.infomaniak.com/app/share/3832823/e84df001-38bf-420e-9b3e-5f0783ce3157";

export default async function FinancePage() {
  const t = await getTranslations("financePage");
  const entries = await getPublicFinanceEntries();

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      {EXPENSES_DOC_URL && (
        <InfoBar>
          {t("expensesDoc.text")}{" "}
          <a
            href={EXPENSES_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-neutral-300 underline decoration-[#e4ae22] decoration-2 underline-offset-2 transition hover:text-neutral-50 active:opacity-70"
          >
            {t("expensesDoc.link")}
          </a>
        </InfoBar>
      )}

      <FinanceLedger entries={entries} />

      <p className="text-center text-xs text-neutral-500">
        {t("jsonFeedNote")} <a href="/api/finance" className="underline hover:text-neutral-300">/api/finance</a>
      </p>
    </div>
  );
}
