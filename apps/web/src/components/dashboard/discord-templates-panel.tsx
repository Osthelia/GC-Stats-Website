/**
 * GC-Stats - discord-templates-panel
 *
 * Image templates of the alerts of a server running its own bot: turn one on per alert type,
 * set its background and preview it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImageIcon, ImagePlus, Loader2, PenLine, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DiscordTemplateEditor } from "@/components/dashboard/discord-template-editor";
import {
  deleteDiscordTemplate,
  removeDiscordBackground,
  saveDiscordTemplate,
  uploadDiscordBackground,
  type SaveDiscordTemplateResult,
} from "@/actions/discord-bot";
import { DISCORD_BOT_EVENTS, type DiscordBotChannel, type DiscordBotEvent, type DiscordBotTemplateView } from "@/lib/discord-bot/shared";
import { createDefaultTemplate, presetsOf, TEMPLATE_ACCENT, TEMPLATE_FOOTER_HEIGHT, type TemplatePreset } from "@/lib/discord-bot/template";

const ACCENT_KEY: Record<DiscordBotEvent, keyof typeof TEMPLATE_ACCENT> = { match_live: "live", match_finished: "finished", map_finished: "map" };
const ACCEPT = "image/png,image/jpeg,image/webp";

/** Default design of an alert type, as the GC Stats bot posts it. */
const defaultPresetOf = (event: DiscordBotEvent): TemplatePreset => presetsOf(ACCENT_KEY[event]).at(-1) ?? "score";

function Preview({ guildId, event, version, locale, ratio, preset }: { guildId: string; event: DiscordBotEvent; version: number; locale: string; ratio: number; preset?: TemplatePreset }) {
  const t = useTranslations("dashboard.discord.templates");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const src = `/api/discord-bot/preview?${new URLSearchParams({ guildId, event, locale, v: String(version), ...(preset ? { preset } : {}) })}`;

  return (
    <div className="relative w-full overflow-hidden rounded-md border bg-muted" style={{ aspectRatio: ratio }}>
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <ImageIcon className="size-5" />
          {t("previewError")}
        </div>
      )}
      {/* The preview is a generated PNG behind auth, next/image would add nothing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} src={src} alt={t("previewAlt")} className={state === "ready" ? "size-full object-cover" : "hidden"} onLoad={() => setState("ready")} onError={() => setState("error")} />
    </div>
  );
}

function TemplateRow({ guildId, event, template, locale, channels }: { guildId: string; event: DiscordBotEvent; template: DiscordBotTemplateView | null; locale: string; channels: DiscordBotChannel[] | null }) {
  const t = useTranslations("dashboard.discord");
  const tt = useTranslations("dashboard.discord.templates");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [preset, setPreset] = useState<TemplatePreset>(defaultPresetOf(event));
  const presetItems = Object.fromEntries(presetsOf(ACCENT_KEY[event]).map((p) => [p, tt(`preset.${p}`)]));

  function run(action: () => Promise<SaveDiscordTemplateResult>, success: string) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.issues?.length ? `${tt(`error.${result.error}`)} ${result.issues.join(", ")}` : tt(`error.${result.error}`));
          return;
        }
        toast.success(success);
        router.refresh();
      } catch {
        toast.error(tt("error.network"));
      }
    });
  }

  function handleToggle(on: boolean) {
    if (on) run(() => saveDiscordTemplate(guildId, event, createDefaultTemplate(ACCENT_KEY[event], preset)), tt("enabled"));
    else run(() => deleteDiscordTemplate(guildId, event), tt("disabled"));
  }

  function handleFile(event_: React.ChangeEvent<HTMLInputElement>) {
    const file = event_.target.files?.[0];
    event_.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    run(() => uploadDiscordBackground(guildId, event, formData), tt("backgroundSaved"));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t(`event.${event}`)}</p>
          <p className="text-xs text-muted-foreground">{template ? tt("usingImage") : tt("usingText")}</p>
        </div>
        <Switch checked={!!template} onCheckedChange={handleToggle} disabled={isPending} aria-label={tt("toggle")} />
      </div>

      {!template && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`preset-${event}`} className="text-xs font-medium">
            {tt("presetLabel")}
          </label>
          <Select items={presetItems} value={preset} onValueChange={(v) => v && setPreset(v as TemplatePreset)}>
            <SelectTrigger id={`preset-${event}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(presetItems).map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{tt("presetHint")}</p>
          <Preview key={preset} guildId={guildId} event={event} version={0} locale={locale} preset={preset} ratio={1000 / createDefaultTemplate(ACCENT_KEY[event], preset).height} />
        </div>
      )}

      {template && (
        <>
          <Preview guildId={guildId} event={event} version={template.updatedAt} locale={locale} ratio={1000 / (template.template.height + (template.template.footer ? TEMPLATE_FOOTER_HEIGHT : 0))} />
          <label className="flex items-start gap-2 text-sm">
            <Switch checked={template.template.footer} disabled={isPending} onCheckedChange={(footer) => run(() => saveDiscordTemplate(guildId, event, { ...template.template, footer }), tt("footerSaved"))} />
            <span className="flex flex-col">
              {tt("footer")}
              <span className="text-xs text-muted-foreground">{tt("footerHint")}</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setEditing(true)} disabled={isPending}>
              <PenLine />
              {tt("editDesign")}
            </Button>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {template.hasBackground ? tt("changeBackground") : tt("addBackground")}
            </Button>
            {template.hasBackground && (
              <Button variant="outline" size="sm" onClick={() => run(() => removeDiscordBackground(guildId, event), tt("backgroundRemoved"))} disabled={isPending}>
                <Trash2 />
                {tt("removeBackground")}
              </Button>
            )}
          </div>
          {editing && (
            // Remounted per save so the editor starts from the stored template.
            <DiscordTemplateEditor
              key={template.updatedAt}
              guildId={guildId}
              event={event}
              initial={template.template}
              backgroundUrl={template.backgroundUrl}
              channels={channels}
              locale={locale}
              open
              onOpenChange={(open) => !open && setEditing(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

/** `locked`: the server uses the GC Stats bot, custom images need its own bot. */
/** `channels` is null when the bot cannot read the channels of the server. */
export function DiscordTemplatesPanel({ guildId, templates, locale, locked, channels }: { guildId: string; templates: DiscordBotTemplateView[]; locale: string; locked: boolean; channels: DiscordBotChannel[] | null }) {
  const t = useTranslations("dashboard.discord.templates");
  const td = useTranslations("dashboard.discord");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="size-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      {locked ? (
        <CardContent className="flex flex-col gap-4">
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">{t("locked")}</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {DISCORD_BOT_EVENTS.map((event) => (
              <div key={event} className="flex flex-col gap-2 rounded-lg border p-4">
                <p className="text-sm font-medium">{td(`event.${event}`)}</p>
                <Preview guildId={guildId} event={event} version={0} locale={locale} preset={defaultPresetOf(event)} ratio={1000 / createDefaultTemplate(ACCENT_KEY[event], defaultPresetOf(event)).height} />
              </div>
            ))}
          </div>
        </CardContent>
      ) : (
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {DISCORD_BOT_EVENTS.map((event) => (
            <TemplateRow key={event} guildId={guildId} event={event} template={templates.find((x) => x.event === event) ?? null} locale={locale} channels={channels} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
