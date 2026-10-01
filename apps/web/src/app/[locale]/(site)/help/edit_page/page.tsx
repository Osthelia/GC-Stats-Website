/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { LegalPageHeader, LegalIntro, SectionCard, SectionList, Callout, icons } from "@/components/legal/ui";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "helpEditPage" });
  return { title: t("title") };
}

export default async function HelpEditPagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("helpEditPage");

  const steps = [t("howTo.step1"), t("howTo.step2"), t("howTo.step3")];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 space-y-8">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <SectionCard icon={icons.link} title={t("howTo.title")}>
        <SectionList items={steps} />
        <Callout>{t("howTo.reviewNotice")}</Callout>
      </SectionCard>
    </div>
  );
}
