/**
 * GC-Stats - discord-subscriptions-panel
 *
 * Alert subscriptions of the Discord bot for one server, on its dashboard page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellRing, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { localeDisplay, routing, type AppLocale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/admin/form-field";
import { DiscordColorField } from "@/components/dashboard/discord-color-field";
import { TeamPicker } from "@/components/admin/team-picker";
import { searchWebhookTeams } from "@/actions/webhooks";
import {
  createDiscordSubscription,
  deleteDiscordSubscription,
  setDiscordSubscriptionActive,
  updateDiscordSubscription,
  type DiscordSubscriptionFieldErrors,
} from "@/actions/discord-bot";
import {
  DISCORD_BOT_DEFAULT_COLORS,
  DISCORD_BOT_EVENTS,
  DISCORD_BOT_LIMITS,
  DISCORD_BOT_OFFICIAL_FILTERS,
  type DiscordBotChannel,
  type DiscordBotEvent,
  type DiscordBotOfficialFilter,
  type DiscordBotSubscriptionView,
} from "@/lib/discord-bot/shared";

type FormState = {
  channelId: string;
  event: DiscordBotEvent;
  locale: string;
  filterRegions: string[];
  filterTeams: { id: number; name: string }[];
  filterOfficial: DiscordBotOfficialFilter;
  color: string | null;
};

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function SubscriptionDialog({
  guildId,
  channels,
  regions,
  defaultLocale,
  editing,
  open,
  onOpenChange,
}: {
  guildId: string;
  channels: DiscordBotChannel[];
  regions: string[];
  defaultLocale: string;
  editing: DiscordBotSubscriptionView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.discord");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(
    editing
      ? { channelId: editing.channelId, event: editing.event, locale: editing.locale, filterRegions: editing.filterRegions, filterTeams: editing.filterTeams, filterOfficial: editing.filterOfficial, color: editing.color }
      : { channelId: "", event: "match_live", locale: defaultLocale, filterRegions: [], filterTeams: [], filterOfficial: "official", color: null },
  );
  const [fieldErrors, setFieldErrors] = useState<DiscordSubscriptionFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const err = (field: keyof DiscordSubscriptionFieldErrors) => (fieldErrors[field] ? t(`error.${field}.${fieldErrors[field]}`, { ...DISCORD_BOT_LIMITS }) : undefined);

  const channelItems = Object.fromEntries(channels.map((c) => [c.id, `#${c.name}`]));
  const eventItems = Object.fromEntries(DISCORD_BOT_EVENTS.map((e) => [e, t(`event.${e}`)]));
  const officialItems = Object.fromEntries(DISCORD_BOT_OFFICIAL_FILTERS.map((v) => [v, t(`official.${v}`)]));
  const localeItems = Object.fromEntries(routing.locales.map((l) => [l, `${localeDisplay[l as AppLocale].flag} ${localeDisplay[l as AppLocale].name}`]));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const input = {
        channelId: form.channelId,
        event: form.event,
        locale: form.locale,
        filterRegions: form.filterRegions,
        filterTeamIds: form.filterTeams.map((team) => team.id),
        filterOfficial: form.filterOfficial,
        color: form.color,
      };
      try {
        const result = editing ? await updateDiscordSubscription(guildId, editing.id, input) : await createDiscordSubscription(guildId, input);
        if (!result.ok) {
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          setFormError(t(`error.${result.error}`, { max: DISCORD_BOT_LIMITS.subscriptionsPerGuild }));
          return;
        }
        toast.success(editing ? t("updated") : t("created"));
        onOpenChange(false);
        router.refresh();
      } catch {
        setFormError(t("error.network"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t("eventLabel")} htmlFor="dc-event" required error={err("event")}>
              <Select items={eventItems} value={form.event} onValueChange={(v) => v && set("event", v as DiscordBotEvent)}>
                <SelectTrigger id="dc-event" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCORD_BOT_EVENTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {eventItems[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("channelLabel")} htmlFor="dc-channel" required error={err("channelId")}>
              <Select items={channelItems} value={form.channelId || null} onValueChange={(v) => v && set("channelId", v)}>
                <SelectTrigger id="dc-channel" className="w-full" aria-invalid={!!fieldErrors.channelId}>
                  <SelectValue placeholder={t("channelPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {channelItems[c.id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label={t("localeLabel")} htmlFor="dc-locale" required error={err("locale")} hint={t("localeHint")}>
            <Select items={localeItems} value={form.locale} onValueChange={(v) => v && set("locale", v)}>
              <SelectTrigger id="dc-locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {routing.locales.map((l) => (
                  <SelectItem key={l} value={l}>
                    {localeItems[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <DiscordColorField
            id="dc-color"
            label={t("alertColorLabel")}
            value={form.color}
            fallback={DISCORD_BOT_DEFAULT_COLORS[form.event === "match_live" ? "live" : form.event === "map_finished" ? "map" : "finished"]}
            resetLabel={t("theme.reset")}
            error={err("color")}
            hint={t("alertColorHint")}
            onChange={(value) => set("color", value)}
          />

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t("filtersTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("filtersHint")}</p>
            </div>

            <FormField label={t("official.label")} htmlFor="dc-official" required error={err("filterOfficial")}>
              <Select items={officialItems} value={form.filterOfficial} onValueChange={(v) => v && set("filterOfficial", v as DiscordBotOfficialFilter)}>
                <SelectTrigger id="dc-official" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCORD_BOT_OFFICIAL_FILTERS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {officialItems[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("regions")} htmlFor="dc-regions" error={err("filterRegions")} hint={t("regionsHint")}>
              <div id="dc-regions" className="flex flex-wrap gap-1.5">
                {regions.map((region) => {
                  const on = form.filterRegions.includes(region);
                  return (
                    <button
                      key={region}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("filterRegions", toggle(form.filterRegions, region))}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-all active:scale-95 ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {region}
                    </button>
                  );
                })}
              </div>
            </FormField>

            <FormField label={t("teams")} htmlFor="dc-teams" error={err("filterTeamIds")} hint={t("teamsHint")}>
              <div className="flex flex-col gap-2">
                {form.filterTeams.length < DISCORD_BOT_LIMITS.filterTeams && (
                  <TeamPicker
                    id="dc-teams"
                    value={null}
                    onChange={(team) => team && !form.filterTeams.some((x) => x.id === team.id) && set("filterTeams", [...form.filterTeams, team])}
                    placeholder={t("teamsPlaceholder")}
                    searchPlaceholder={t("teamsSearch")}
                    noResultsLabel={t("teamsNoResults")}
                    search={searchWebhookTeams}
                  />
                )}
                {form.filterTeams.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.filterTeams.map((team) => (
                      <Badge key={team.id} variant="secondary" className="gap-1 pr-1">
                        {team.name}
                        <button
                          type="button"
                          onClick={() => set("filterTeams", form.filterTeams.filter((x) => x.id !== team.id))}
                          aria-label={t("removeTeam", { name: team.name })}
                          className="rounded-sm p-0.5 transition-colors hover:bg-background/60 active:bg-background"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </FormField>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DiscordSubscriptionsPanel({
  guildId,
  subscriptions,
  channels,
  regions,
  defaultLocale,
}: {
  guildId: string;
  subscriptions: DiscordBotSubscriptionView[];
  /** Null when the bot cannot read the server's channels. */
  channels: DiscordBotChannel[] | null;
  regions: string[];
  defaultLocale: string;
}) {
  const t = useTranslations("dashboard.discord");
  const router = useRouter();
  const [dialog, setDialog] = useState<{ editing: DiscordBotSubscriptionView | null } | null>(null);
  const [deleting, setDeleting] = useState<DiscordBotSubscriptionView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const channelName = (id: string) => channels?.find((c) => c.id === id)?.name;

  async function handleToggle(subscription: DiscordBotSubscriptionView) {
    setBusy(`toggle-${subscription.id}`);
    try {
      const result = await setDiscordSubscriptionActive(guildId, subscription.id, !subscription.isActive);
      if (result.ok) router.refresh();
      else toast.error(t(`error.${result.error}`));
    } catch {
      toast.error(t("error.network"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    setBusy(`delete-${target.id}`);
    try {
      const result = await deleteDiscordSubscription(guildId, target.id);
      if (result.ok) {
        toast.success(t("deleted"));
        router.refresh();
      } else toast.error(t(`error.${result.error}`));
    } catch {
      toast.error(t("error.network"));
    } finally {
      setBusy(null);
      setDeleting(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4" />
          {t("alertsTitle")}
        </CardTitle>
        <CardDescription>{t("alertsDescription")}</CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setDialog({ editing: null })} disabled={!channels || subscriptions.length >= DISCORD_BOT_LIMITS.subscriptionsPerGuild}>
            <Plus />
            {t("add")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!channels && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">{t("channelsUnavailable")}</p>}

        {subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t(`event.${subscription.event}`)}</p>
                    <p className="truncate text-xs text-muted-foreground">{channelName(subscription.channelId) ? `#${channelName(subscription.channelId)}` : t("channelMissing")}</p>
                    {subscription.disabledReason && !subscription.isActive && <p className="mt-1 text-xs text-destructive">{t("disabledLostChannel")}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{subscription.isActive ? t("active") : t("inactive")}</span>
                    <Switch checked={subscription.isActive} onCheckedChange={() => handleToggle(subscription)} disabled={busy === `toggle-${subscription.id}`} aria-label={t("toggle")} />
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <div>
                    <dt className="inline font-medium text-foreground">{t("official.label")}: </dt>
                    <dd className="inline">{t(`official.${subscription.filterOfficial}`)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">{t("regions")}: </dt>
                    <dd className="inline">{subscription.filterRegions.length ? subscription.filterRegions.join(", ") : t("any")}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">{t("teams")}: </dt>
                    <dd className="inline">{subscription.filterTeams.length ? subscription.filterTeams.map((team) => team.name).join(", ") : t("any")}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDialog({ editing: subscription })} disabled={!channels}>
                    <Pencil />
                    {t("edit")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleting(subscription)} disabled={busy === `delete-${subscription.id}`}>
                    <Trash2 />
                    {t("delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {dialog && channels && (
        <SubscriptionDialog
          key={dialog.editing?.id ?? "new"}
          guildId={guildId}
          channels={channels}
          regions={regions}
          defaultLocale={defaultLocale}
          editing={dialog.editing}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={busy?.startsWith("delete-") ?? false}
        destructive
      />
    </Card>
  );
}
