/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import { requireDiscordAccess } from "@/lib/dashboard-rbac";
import { listManageableGuilds } from "@/lib/discord-bot/guilds";
import { countSubscriptionsByGuild } from "@/lib/discord-bot/subscriptions";
import { getGcsBotInviteUrl } from "@/lib/discord-bot/shared";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.discord" });
  return { title: t("serversTitle") };
}

export default async function DashboardDiscordServersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { userId } = await requireDiscordAccess(locale as AppLocale);
  const t = await getTranslations({ locale, namespace: "dashboard.discord" });
  const result = await listManageableGuilds(userId);
  const counts = result.ok ? await countSubscriptionsByGuild(result.guilds.filter((g) => g.botJoined).map((g) => g.id)) : new Map<string, number>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("serversTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("serversSubtitle")}</p>
      </div>

      {!result.ok ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">{t("serversUnavailable")}</p>
            <Button variant="outline" size="sm" render={<Link href="/settings/account" />}>
              {t("reconnectDiscord")}
            </Button>
          </CardContent>
        </Card>
      ) : result.guilds.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("serversEmpty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.guilds.map((guild) => {
            const inviteUrl = guild.botJoined ? null : getGcsBotInviteUrl(guild.id);
            return (
              <div key={guild.id} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <OrgLogoTile name={guild.name} logoUrl={guild.iconUrl} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{guild.name}</p>
                    {guild.botJoined ? (
                      <p className="text-xs text-muted-foreground">{t("subscriptionCount", { count: counts.get(guild.id) ?? 0 })}</p>
                    ) : (
                      <Badge variant="outline" className="mt-0.5">
                        {t("botNotJoined")}
                      </Badge>
                    )}
                  </div>
                </div>
                {guild.botJoined ? (
                  <Button variant="outline" size="sm" render={<Link href={`/dashboard/discord/${guild.id}`} />}>
                    <Bot />
                    {t("configure")}
                  </Button>
                ) : inviteUrl ? (
                  <Button size="sm" render={<a href={inviteUrl} target="_blank" rel="noopener noreferrer" />}>
                    <Bot />
                    {t("addBot")}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("botUnavailable")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
