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
import { DiscordTemplateEditor } from "@/components/dashboard/discord-template-editor";
import {
  chooseDiscordTemplatePreset,
  removeDiscordBackground,
  uploadDiscordBackground,
  type SaveDiscordTemplateResult,
} from "@/actions/discord-bot";
import { DISCORD_BOT_EVENTS, type DiscordBotChannel, type DiscordBotEvent, type DiscordBotTemplateView } from "@/lib/discord-bot/shared";
import { createDefaultTemplate, presetOfTemplate, presetsOf, TEMPLATE_ACCENT, TEMPLATE_FOOTER_HEIGHT, type TemplatePreset } from "@/lib/discord-bot/template";

const ACCENT_KEY: Record<DiscordBotEvent, keyof typeof TEMPLATE_ACCENT> = { match_live: "live", match_finished: "finished", map_finished: "map" };
const ACCEPT = "image/png,image/jpeg,image/webp";

/** Default design of an alert type, as the GC Stats bot posts it. */
const defaultPresetOf = (event: DiscordBotEvent): TemplatePreset => presetsOf(ACCENT_KEY[event]).at(-1) ?? "score";

const PREVIEW_MAX_RETRIES = 2;
const PREVIEW_RETRY_DELAY_MS = 1500;

function Preview({ guildId, event, version, locale, ratio, preset }: { guildId: string; event: DiscordBotEvent; version: number; locale: string; ratio: number; preset?: TemplatePreset }) {
  const t = useTranslations("dashboard.discord.templates");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const src = `/api/discord-bot/preview?${new URLSearchParams({ guildId, event, locale, v: String(version), ...(preset ? { preset } : {}), ...(attempt ? { retry: String(attempt) } : {}) })}`;

  // A failed image is retried twice after a short pause, a busy server or Discord often recovers.
  function handleError() {
    if (attempt >= PREVIEW_MAX_RETRIES) return setState("error");
    setTimeout(() => setAttempt((n) => n + 1), PREVIEW_RETRY_DELAY_MS * (attempt + 1));
  }

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
      <img key={src} src={src} alt={t("previewAlt")} className={state === "ready" ? "size-full object-cover" : "hidden"} onLoad={() => setState("ready")} onError={handleError} />
    </div>
  );
}

function TemplateRow({ guildId, event, template, locale, channels, background }: { guildId: string; event: DiscordBotEvent; template: DiscordBotTemplateView | null; locale: string; channels: DiscordBotChannel[] | null; background: string }) {
  const t = useTranslations("dashboard.discord");
  const tt = useTranslations("dashboard.discord.templates");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  // Without a saved design the editor starts from the default one.
  const current = template?.template ?? createDefaultTemplate(ACCENT_KEY[event], defaultPresetOf(event), background);

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
      <div>
        <p className="text-sm font-medium">{t(`event.${event}`)}</p>
        <p className="text-xs text-muted-foreground">{template ? tt("usingImage") : tt("usingText")}</p>
      </div>

      <Preview
        guildId={guildId}
        event={event}
        version={template?.updatedAt ?? 0}
        locale={locale}
        preset={template ? undefined : defaultPresetOf(event)}
        ratio={1000 / (current.height + (current.footer ? TEMPLATE_FOOTER_HEIGHT : 0))}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditing(true)} disabled={isPending}>
          <PenLine />
          {tt("editDesign")}
        </Button>
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFile} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {template?.hasBackground ? tt("changeBackground") : tt("addBackground")}
        </Button>
        {template?.hasBackground && (
          <Button variant="outline" size="sm" onClick={() => run(() => removeDiscordBackground(guildId, event), tt("backgroundRemoved"))} disabled={isPending}>
            <Trash2 />
            {tt("removeBackground")}
          </Button>
        )}
      </div>
      {editing && (
        // Remounted per save so the editor starts from the stored template.
        <DiscordTemplateEditor
          key={template?.updatedAt ?? 0}
          guildId={guildId}
          event={event}
          initial={current}
          backgroundUrl={template?.backgroundUrl ?? null}
          defaultBackground={background}
          channels={channels}
          locale={locale}
          open
          onOpenChange={(open) => !open && setEditing(false)}
        />
      )}
    </div>
  );
}

/** Server on the GC Stats bot: picks a ready-made design per alert type, without customization. */
function PresetRow({ guildId, event, template, locale }: { guildId: string; event: DiscordBotEvent; template: DiscordBotTemplateView | null; locale: string }) {
  const t = useTranslations("dashboard.discord");
  const tt = useTranslations("dashboard.discord.templates");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const kind = ACCENT_KEY[event];
  const value = template ? (presetOfTemplate(template.template, kind) ?? "none") : "none";
  const items = { none: tt("presetNone"), ...Object.fromEntries(presetsOf(kind).map((p) => [p, tt(`preset.${p}`)])) };
  const shown = value === "none" ? undefined : (value as TemplatePreset);

  function handleChange(next: string) {
    startTransition(async () => {
      try {
        const result = await chooseDiscordTemplatePreset(guildId, event, next);
        if (!result.ok) {
          toast.error(tt(`error.${result.error}`));
          return;
        }
        toast.success(tt("presetSaved"));
        router.refresh();
      } catch {
        toast.error(tt("error.network"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <p className="text-sm font-medium">{t(`event.${event}`)}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`preset-${event}`} className="text-xs font-medium">
          {tt("presetChoose")}
        </label>
        <Select items={items} value={value} onValueChange={(v) => v && v !== value && handleChange(v)} disabled={isPending}>
          <SelectTrigger id={`preset-${event}`} className="w-full">
            {isPending ? <Loader2 className="animate-spin" /> : null}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(items).map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {shown ? (
        <Preview key={shown} guildId={guildId} event={event} version={template?.updatedAt ?? 0} locale={locale} preset={shown} ratio={1000 / createDefaultTemplate(kind, shown).height} />
      ) : (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{tt("usingText")}</p>
      )}
    </div>
  );
}

/** `locked`: the server uses the GC Stats bot, custom images need its own bot. */
/** `channels` is null when the bot cannot read the channels of the server. */
export function DiscordTemplatesPanel({ guildId, templates, locale, locked, channels, background }: { guildId: string; templates: DiscordBotTemplateView[]; locale: string; locked: boolean; channels: DiscordBotChannel[] | null; background: string }) {
  const t = useTranslations("dashboard.discord.templates");
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
              <PresetRow key={event} guildId={guildId} event={event} template={templates.find((x) => x.event === event) ?? null} locale={locale} />
            ))}
          </div>
        </CardContent>
      ) : (
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {DISCORD_BOT_EVENTS.map((event) => (
            <TemplateRow key={event} guildId={guildId} event={event} template={templates.find((x) => x.event === event) ?? null} locale={locale} channels={channels} background={background} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
