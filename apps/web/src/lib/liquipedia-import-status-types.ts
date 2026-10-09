/**
 * GC-Stats - liquipedia-import-status-types
 *
 * Client safe part of the import status (no db import), plus its colors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** done: Riot data fetched, partial: match id present without Riot data, none: nothing imported. */
export type LiquipediaImportStatus = "done" | "partial" | "none";

export const IMPORT_STATUS_CARD_CLASS: Record<LiquipediaImportStatus, string> = {
  done: "border-emerald-500/70 bg-emerald-500/10 hover:border-emerald-400",
  partial: "border-amber-500/70 bg-amber-500/10 hover:border-amber-400",
  none: "border-red-500/70 bg-red-500/10 hover:border-red-400",
};

export const IMPORT_STATUS_ROW_CLASS: Record<LiquipediaImportStatus, string> = {
  done: "bg-emerald-500/10 hover:bg-emerald-500/20",
  partial: "bg-amber-500/10 hover:bg-amber-500/20",
  none: "bg-red-500/10 hover:bg-red-500/20",
};

export const IMPORT_STATUS_DOT_CLASS: Record<LiquipediaImportStatus, string> = {
  done: "bg-emerald-500",
  partial: "bg-amber-500",
  none: "bg-red-500",
};
