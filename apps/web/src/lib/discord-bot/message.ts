/**
 * GC-Stats - message
 *
 * Builds what the bot posts for an alert: a container with the teams and score as text, the alert image and a button to the match.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { DiscordAttachment, DiscordComponent } from "./api";
import { renderTemplateImage } from "./image";
import { resolveAlertFields, resolveAlertImages, resolveMatchButtonLabel, type AlertColors, type AlertKind, type AlertMap, type AlertMatch } from "./render";
import { GCS_SITE_URL, hexToInt } from "./shared";
import { createGcsTemplate, TEMPLATE_PRESETS, type AlertTemplate, type TemplateBlock } from "./template";

const IMAGE_FILENAME = "alert.png";

// Components V2 types.
const ACTION_ROW = 1;
const BUTTON = 2;
const TEXT_DISPLAY = 10;
const MEDIA_GALLERY = 12;
const CONTAINER = 17;
const LINK_BUTTON_STYLE = 5;

export type AlertMessage = { components: DiscordComponent[]; attachment?: DiscordAttachment };

type ComposeInput = {
  kind: AlertKind;
  fields: Record<string, string>;
  /** Hex color of the container accent. */
  accent: string;
  /** Rendered alert image, null when it could not be drawn (the text still tells the story). */
  image: Buffer | null;
  /** Page of the match, the target of the button. */
  url: string;
  /** Null hides the button. */
  buttonLabel: string | null;
};

/** The alert as a container: the image, the teams and score as text, then the button opening the match. */
export function composeAlertMessage({ kind, fields, accent, image, url, buttonLabel }: ComposeInput): AlertMessage {
  const subtext = [fields.status, fields.tournament, kind === "map" ? fields.map : ""].filter(Boolean).join("  ·  ");
  const heading = `## ${fields.teamA} ${fields.score} ${fields.teamB}`;
  // Without the image, the finished maps carry the information it would have shown.
  const details = !image && fields.mapsInline ? `\n${fields.mapsInline}` : "";
  // Same layout as the other Osthelia containers: media on top, then the text, then the buttons.
  const children: DiscordComponent[] = [];
  if (image) children.push({ type: MEDIA_GALLERY, items: [{ media: { url: `attachment://${IMAGE_FILENAME}` } }] });
  children.push({ type: TEXT_DISPLAY, content: `${heading}${subtext ? `\n-# ${subtext}` : ""}${details}`.slice(0, 3900) });
  if (buttonLabel) children.push({ type: ACTION_ROW, components: [{ type: BUTTON, style: LINK_BUTTON_STYLE, label: buttonLabel, url }] });
  return {
    components: [{ type: CONTAINER, accent_color: hexToInt(accent), components: children }],
    attachment: image ? { filename: IMAGE_FILENAME, data: image, contentType: "image/png" } : undefined,
  };
}

export async function buildAlertMessage(kind: AlertKind, match: AlertMatch, locale: string, map: AlertMap | undefined, colors: AlertColors, template: AlertTemplate | null, matchButton: boolean): Promise<AlertMessage> {
  const live = kind === "live" && match.status === "live";
  const fields = await resolveAlertFields(kind, match, locale, map);
  const images = resolveAlertImages(kind, match, map);

  const url = `${GCS_SITE_URL}/${locale}/match/${match.id}`;
  const accent = live ? colors.live : kind === "map" ? colors.map : colors.finished;
  const imageData = { fields, images, locale, footerUrl: url.replace(/^https?:\/\//, "") };

  let image: Buffer | null = null;
  try {
    if (template) {
      image = await renderTemplateImage(template, imageData);
    } else {
      // Default bot: GC Stats design with every block that has data.
      const available: Record<TemplateBlock, boolean> = { maps: !!fields.mapsInline, vetos: !!fields.vetos, mvp: !!fields.mvp };
      const blocks = (kind === "map" ? TEMPLATE_PRESETS.map.mvp : TEMPLATE_PRESETS[kind].full).filter((b) => available[b]);
      image = await renderTemplateImage(createGcsTemplate(accent, kind, blocks, colors.background), imageData);
    }
  } catch (error) {
    console.error("[discord-bot] image render failed (%s #%d)", kind, match.id, error);
  }
  return composeAlertMessage({ kind, fields, accent, image, url, buttonLabel: matchButton ? await resolveMatchButtonLabel(locale) : null });
}
