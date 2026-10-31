/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LegalPageHeader, LegalIntro, SectionCard, SectionText, SmallCard, Callout, icons } from "@/components/legal/ui";
import { DISCORD_INVITE_URL } from "@/lib/discord-invite";
import { getGcsBotInviteUrl } from "@/lib/discord-bot/shared";
import { staticTitleMetadata } from "@/lib/page-metadata";
import { getCurrentUserId } from "@/lib/session";
import { getLinkedDiscordId } from "@/lib/discord-guild-membership";
import type { AppLocale } from "@/i18n/routing";

export const generateMetadata = staticTitleMetadata("discordBot.title");

const FEATURES = ["live", "finished", "map", "filters"] as const;
const STEPS = ["invite", "login", "configure"] as const;

const buttonClass =
  "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-all active:scale-95";

export default async function DiscordBotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const [t, tDashboard] = await Promise.all([getTranslations("discordBot"), getTranslations("dashboard.discord")]);
  const inviteUrl = getGcsBotInviteUrl();

  // The dashboard needs a linked Discord account: visitors sign in with it, signed in members without one link it in their settings.
  const userId = await getCurrentUserId();
  const discordLinked = userId ? !!(await getLinkedDiscordId(userId)) : false;
  const dashboardHref = !userId ? { pathname: "/login", query: { callbackUrl: "/dashboard/discord" } } : discordLinked ? "/dashboard/discord" : "/settings/account";

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-16">
      <LegalPageHeader title={t("title")} />
      <LegalIntro>{t("intro")}</LegalIntro>

      <div className="flex flex-wrap justify-center gap-3 pt-2">
        {inviteUrl ? (
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClass} bg-[#e4ae22] text-[#0e0e0e] hover:bg-[#f0bd3a] active:bg-[#c99a1c]`}
          >
            {t("addBot")}
          </a>
        ) : (
          <span className={`${buttonClass} cursor-not-allowed border border-neutral-800 text-neutral-500`}>{t("comingSoon")}</span>
        )}
        <Link
          href={dashboardHref}
          className={`${buttonClass} border border-neutral-800 bg-[var(--gcs-surface)] text-neutral-50 hover:border-[#e4ae22]/60 active:bg-[var(--gcs-surface-2)]`}
        >
          {userId && !discordLinked ? tDashboard("reconnectDiscord") : t("openDashboard")}
        </Link>
      </div>

      <div className="space-y-5 pt-6">
        <SectionCard icon={icons.layers} title={t("features.title")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((key) => (
              <SmallCard key={key} title={t(`features.${key}.title`)}>
                {t(`features.${key}.body`)}
              </SmallCard>
            ))}
          </div>
        </SectionCard>

        <SectionCard icon={icons.shield} title={t("dashboard.title")}>
          <SectionText>{t("dashboard.body")}</SectionText>
          <Callout>{t("dashboard.why")}</Callout>
        </SectionCard>

        <SectionCard icon={icons.info} title={t("steps.title")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STEPS.map((key, i) => (
              <SmallCard key={key} title={`${i + 1}. ${t(`steps.${key}.title`)}`}>
                {t(`steps.${key}.body`)}
              </SmallCard>
            ))}
          </div>
        </SectionCard>

        <SectionCard icon={icons.discord} title={t("help.title")}>
          <SectionText>
            {t.rich("help.body", {
              link: (chunks) => (
                <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="text-[#e4ae22] hover:underline">
                  {chunks}
                </a>
              ),
            })}
          </SectionText>
        </SectionCard>
      </div>
    </div>
  );
}
