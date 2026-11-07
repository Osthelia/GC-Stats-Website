/**
 * GC-Stats - preview
 *
 * Data the dashboard previews are filled with: a real match, or the sample match when it cannot be loaded.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { loadPreviewMatch } from "./match-data";
import { resolveAlertFields, resolveAlertImages } from "./render";
import { SAMPLE_MAPS, sampleMatch, type AlertKind, type AlertMatch } from "./variables";

export type PreviewData = { matchId: number; fields: Record<string, string>; images: Record<string, string | null> };

export async function resolvePreviewData(kind: AlertKind, locale: string): Promise<PreviewData> {
  const real = await loadPreviewMatch().catch((error) => {
    console.error("[discord-bot] preview match load failed", error);
    return null;
  });
  // A live alert needs a live match, the preview match is usually finished.
  const match: AlertMatch = real ? (kind === "live" ? { ...real, status: "live" } : real) : sampleMatch(kind);
  const completed = match.maps.filter((m) => m.isCompleted).sort((a, b) => b.order - a.order);
  const map = kind === "map" ? (real ? (completed[0] ?? match.maps[0]) : SAMPLE_MAPS[0]) : undefined;
  return { matchId: match.id, fields: await resolveAlertFields(kind, match, locale, map), images: resolveAlertImages(kind, match, map) };
}
