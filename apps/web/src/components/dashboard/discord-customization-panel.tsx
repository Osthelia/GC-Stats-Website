/**
 * GC-Stats - discord-customization-panel
 *
 * Theme of a Discord server on its dashboard page: embed colors and the server's own bot.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bot, Palette } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/admin/form-field";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import { DiscordColorField } from "@/components/dashboard/discord-color-field";
import { connectCustomDiscordBot, disconnectCustomDiscordBot, saveDiscordColors, type DiscordColorsFieldErrors } from "@/actions/discord-bot";
import { DISCORD_BOT_THEME_DEFAULTS, type DiscordBotSettingsView, type DiscordBotThemeColorKey } from "@/lib/discord-bot/shared";

const COLOR_KEYS = Object.keys(DISCORD_BOT_THEME_DEFAULTS) as DiscordBotThemeColorKey[];

function ColorsCard({ guildId, settings }: { guildId: string; settings: DiscordBotSettingsView }) {
  const t = useTranslations("dashboard.discord.theme");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [colors, setColors] = useState(settings.colors);
  const [matchButton, setMatchButton] = useState(settings.matchButton);
  const [fieldErrors, setFieldErrors] = useState<DiscordColorsFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await saveDiscordColors(guildId, { ...colors, matchButton });
        if (!result.ok) {
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          setFormError(t(`error.${result.error}`));
          return;
        }
        toast.success(t("colorsSaved"));
        router.refresh();
      } catch {
        setFormError(t("error.network"));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-4" />
          {t("colorsTitle")}
        </CardTitle>
        <CardDescription>{t("colorsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {COLOR_KEYS.map((key) => (
              <DiscordColorField
                key={key}
                id={`dc-color-${key}`}
                label={t(`color.${key}`)}
                value={colors[key]}
                fallback={DISCORD_BOT_THEME_DEFAULTS[key]}
                resetLabel={t("reset")}
                error={fieldErrors[key] ? t("error.color") : undefined}
                onChange={(value) => setColors((prev) => ({ ...prev, [key]: value }))}
              />
            ))}
          </div>
          <div className="flex items-start gap-3">
            <Switch id="dc-match-button" checked={matchButton} onCheckedChange={setMatchButton} disabled={isPending} />
            <label htmlFor="dc-match-button" className="flex flex-col gap-0.5 text-sm">
              <span className="font-medium">{t("matchButton")}</span>
              <span className="text-xs text-muted-foreground">{t("matchButtonHint")}</span>
            </label>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BotCard({ guildId, settings, inviteUrl }: { guildId: string; settings: DiscordBotSettingsView; inviteUrl: string | null }) {
  const t = useTranslations("dashboard.discord.theme");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function handleConnect(event: React.FormEvent) {
    event.preventDefault();
    setTokenError(null);
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await connectCustomDiscordBot(guildId, token);
        if (!result.ok) {
          if (result.fieldErrors) setTokenError(t(`error.token.${result.fieldErrors.token}`));
          else setFormError(t(`error.${result.error}`));
          return;
        }
        setToken("");
        toast.success(t("botConnected"));
        router.refresh();
      } catch {
        setFormError(t("error.network"));
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      try {
        const result = await disconnectCustomDiscordBot(guildId);
        if (result.ok) {
          toast.success(t("botDisconnected"));
          router.refresh();
        } else toast.error(t(`error.${result.error}`));
      } catch {
        toast.error(t("error.network"));
      } finally {
        setConfirmRemove(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-4" />
          {t("botTitle")}
        </CardTitle>
        <CardDescription>{t("botDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {settings.bot ? (
          <>
            <div className="flex items-center gap-3">
              <OrgLogoTile name={settings.bot.name} logoUrl={settings.bot.avatarUrl} className="size-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{settings.bot.name}</p>
                <p className="text-xs text-muted-foreground">{t("botActive")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {inviteUrl && (
                <Button variant="outline" size="sm" render={<a href={inviteUrl} target="_blank" rel="noopener noreferrer" />}>
                  {t("botInvite")}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)} disabled={isPending}>
                {t("botDisconnect")}
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleConnect} className="flex flex-col gap-3">
            <FormField label={t("tokenLabel")} htmlFor="dc-bot-token" required error={tokenError} hint={t("tokenHint")}>
              <Input id="dc-bot-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} aria-invalid={!!tokenError} />
            </FormField>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <Button type="submit" className="w-fit" disabled={isPending}>
              {isPending ? t("botConnecting") : t("botConnect")}
            </Button>
          </form>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("botDisconnectTitle")}
        description={t("botDisconnectDescription")}
        confirmLabel={t("botDisconnect")}
        cancelLabel={t("cancel")}
        onConfirm={handleDisconnect}
        isPending={isPending}
        destructive
      />
    </Card>
  );
}

/** `inviteUrl` re-invites the server's own bot, built on the server since the client has no env. */
export function DiscordCustomizationPanel({ guildId, settings, inviteUrl }: { guildId: string; settings: DiscordBotSettingsView; inviteUrl: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <BotCard guildId={guildId} settings={settings} inviteUrl={inviteUrl} />
      <ColorsCard guildId={guildId} settings={settings} />
    </div>
  );
}
