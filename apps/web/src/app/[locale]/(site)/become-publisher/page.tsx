/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, SectionList, ChannelCard, icons } from "@/components/legal/ui";
import { DISCORD_INVITE_URL, DISCORD_INVITE_LABEL } from "@/lib/discord-invite";

export default function BecomePublisherPage() {
  const t = useTranslations("becomePublisher");

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <div className="space-y-5 pt-6">
        <SectionCard icon={icons.info} title={t("what.title")}>
          <SectionText>{t("what.body")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.layers} title={t("freedom.title")}>
          <SectionList items={t.raw("freedom.items") as string[]} />
        </SectionCard>

        <SectionCard icon={icons.mail} title={t("howTo.title")}>
          <SectionText>{t("howTo.body")}</SectionText>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ChannelCard icon={icons.discord} title={t("channels.discord")} value={DISCORD_INVITE_LABEL} href={DISCORD_INVITE_URL} />
            <ChannelCard icon={icons.mail} title={t("channels.email")} value="contact@osthelia.org" href="mailto:contact@osthelia.org" />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
