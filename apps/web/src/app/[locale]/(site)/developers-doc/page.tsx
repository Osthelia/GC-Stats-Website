/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, SectionList, ChannelCard, icons } from "@/components/legal/ui";
import { Link } from "@/i18n/navigation";
import { DISCORD_INVITE_URL, DISCORD_INVITE_LABEL } from "@/lib/discord-invite";

export default function DevelopersDocPage() {
  const t = useTranslations("developersDoc");

  const repos = [
    { name: "Osthelia/GC-Stats-Website", url: "https://github.com/Osthelia/GC-Stats-Website" },
    { name: "Osthelia/GC-Stats-Documentation", url: "https://github.com/Osthelia/GC-Stats-Documentation" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <div className="space-y-5 pt-6">
        <SectionCard icon={icons.key} title={t("apiKey.title")}>
          <SectionText>{t("apiKey.body")}</SectionText>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("apiKey.warning")}</p>
            <SectionList items={[t("apiKey.step1"), t("apiKey.step2"), t("apiKey.step3")]} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ChannelCard icon={icons.discord} title={t("apiKey.channels.discord")} value={DISCORD_INVITE_LABEL} href={DISCORD_INVITE_URL} />
            <ChannelCard icon={icons.mail} title={t("apiKey.channels.email")} value="contact@gc-stats.app" href="mailto:contact@gc-stats.app" />
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            {t.rich("apiKey.termsNote", {
              terms: (chunks) => (
                <Link href="/terms" className="text-[#e4ae22] hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </SectionCard>

        <SectionCard icon={icons.ban} title={t("restrictions.title")}>
          <SectionText>{t("restrictions.body")}</SectionText>
        </SectionCard>

        <SectionCard icon={icons.code} title={t("apiReference.title")}>
          <div className="flex items-start justify-between gap-4">
            <SectionText>{t("apiReference.body")}</SectionText>
            <a
              href="https://docs.gc-stats.app/api/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center rounded-lg bg-[#e4ae22] px-4 py-2 text-[13px] font-semibold text-[#0e0e0e] transition hover:bg-[#c9981d] active:scale-95"
            >
              {t("apiReference.badge")}
            </a>
          </div>
        </SectionCard>

        <SectionCard icon={icons.github} title={t("openSource.title")}>
          <SectionText>{t("openSource.body")}</SectionText>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {repos.map((repo) => (
              <ChannelCard key={repo.url} icon={icons.github} title={repo.name} value={t("openSource.badge")} href={repo.url} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
