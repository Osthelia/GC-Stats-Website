/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { discordBackgroundUrl } from "@gc-stats/storage";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import { DiscordCustomizationPanel } from "@/components/dashboard/discord-customization-panel";
import { DiscordTemplatesPanel } from "@/components/dashboard/discord-templates-panel";
import { DiscordSubscriptionsPanel } from "@/components/dashboard/discord-subscriptions-panel";
import { requireDiscordAccess } from "@/lib/dashboard-rbac";
import { getManageableGuild, listGuildTextChannels } from "@/lib/discord-bot/guilds";
import { listGuildSubscriptions } from "@/lib/discord-bot/subscriptions";
import { getGuildTemplates } from "@/lib/discord-bot/templates";
import { getGuildSettings, toSettingsView } from "@/lib/discord-bot/settings";
import { getGcsBotInviteUrl } from "@/lib/discord-bot/shared";
import { listWebhookRegions } from "@/lib/webhooks/endpoints";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.discord" });
  return { title: t("serverTitle") };
}

export default async function DashboardDiscordServerPage({ params }: { params: Promise<{ locale: string; guildId: string }> }) {
  const { locale, guildId } = await params;
  const { userId } = await requireDiscordAccess(locale as AppLocale);
  const guild = await getManageableGuild(userId, guildId);
  if (!guild) notFound();

  const t = await getTranslations({ locale, namespace: "dashboard.discord" });
  const [channels, subscriptions, regions] = guild.botJoined ? await Promise.all([listGuildTextChannels(guild.id), listGuildSubscriptions(guild.id), listWebhookRegions()]) : [null, [], []];
  const settings = toSettingsView(await getGuildSettings(guild.id));
  const templates = [...(await getGuildTemplates(guild.id)).entries()].map(([event, stored]) => ({
    event,
    template: stored.template,
    backgroundUrl: stored.template.backgroundImageId ? discordBackgroundUrl(stored.template.backgroundImageId) : null,
    hasBackground: !!stored.template.backgroundImageId,
    updatedAt: stored.updatedAt.getTime(),
  }));
  const inviteUrl = guild.botJoined ? null : getGcsBotInviteUrl(guild.id, settings.bot?.userId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/discord" />}>
          <ArrowLeft />
          {t("backToServers")}
        </Button>
        <div className="flex items-center gap-3">
          <OrgLogoTile name={guild.name} logoUrl={guild.iconUrl} className="size-10" />
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold">{guild.name}</h1>
            <p className="text-sm text-muted-foreground">{t("serverSubtitle")}</p>
          </div>
        </div>
      </div>

      <DiscordCustomizationPanel guildId={guild.id} settings={settings} inviteUrl={settings.bot ? getGcsBotInviteUrl(guild.id, settings.bot.userId) : null} />

      <DiscordTemplatesPanel guildId={guild.id} templates={templates} locale={locale} locked={!settings.bot} channels={channels} />

      {guild.botJoined ? (
        <DiscordSubscriptionsPanel guildId={guild.id} subscriptions={subscriptions} channels={channels} regions={regions} defaultLocale={locale} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">{t("botNotJoinedBody")}</p>
            {inviteUrl && (
              <Button size="sm" render={<a href={inviteUrl} target="_blank" rel="noopener noreferrer" />}>
                {t("addBot")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
