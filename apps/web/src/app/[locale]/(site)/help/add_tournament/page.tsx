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
import { LegalPageHeader, LegalIntro, SectionCard, Callout, ChannelCard, icons } from "@/components/legal/ui";
import { DISCORD_INVITE_URL, DISCORD_INVITE_LABEL } from "@/lib/discord-invite";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "helpAddTournament" });
  return { title: t("title") };
}

export default async function HelpAddTournamentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("helpAddTournament");

  const infoItems = [
    { label: t("info.identityLabel"), text: t("info.identityText") },
    { label: t("info.structureLabel"), text: t("info.structureText") },
    { label: t("info.participantsLabel"), text: t("info.participantsText") },
    { label: t("info.matchDataLabel"), text: t("info.matchDataText") },
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 space-y-8">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <SectionCard icon={icons.discord} title={t("ticket.title")}>
        <p className="text-sm leading-relaxed text-neutral-400">{t("ticket.body")}</p>
        <ChannelCard icon={icons.discord} title={t("ticket.discordCta")} value={DISCORD_INVITE_LABEL} href={DISCORD_INVITE_URL} />
        <Callout>{t("ticket.hint")}</Callout>
      </SectionCard>

      <SectionCard icon={icons.info} title={t("info.title")}>
        <ul className="space-y-3">
          {infoItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-400">
              <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[#e4ae22]" />
              <span>
                <strong className="font-semibold text-neutral-200">{item.label}</strong> {item.text}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <p className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("footerNote")}</p>
    </div>
  );
}
