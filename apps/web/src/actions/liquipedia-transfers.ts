/**
 * GC-Stats - liquipedia-transfers
 *
 * Completes a monthly Liquipedia transfers page with the roster movements of
 * that month. The roster data is already public on the site, so no
 * permission is needed.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { getCompletedTransfersWikicode, type TransfersWikicode } from "@/lib/liquipedia-transfers-data";
import { TRANSFERS_WIKICODE_MAX_LENGTH, detectPageMonth, parseMonthValue, validateTransferPage } from "@/lib/liquipedia-transfers-wikicode";

export type TransfersField = "wikicode" | "month";
export type TransfersFieldErrors = Partial<Record<TransfersField, string>>;
export type TransfersResult = ({ ok: true; month: string } & TransfersWikicode) | { ok: false; fieldErrors: TransfersFieldErrors };

/** `month` is `YYYY-MM`, empty to read it from the page (its title, else its rows' dates). */
export async function completeTransfersWikicode(wikicode: string, month: string): Promise<TransfersResult> {
  const fieldErrors: TransfersFieldErrors = {};

  if (typeof wikicode !== "string" || !wikicode.trim()) fieldErrors.wikicode = "required";
  else if (wikicode.length > TRANSFERS_WIKICODE_MAX_LENGTH) fieldErrors.wikicode = "tooLong";
  else fieldErrors.wikicode = validateTransferPage(wikicode) ?? undefined;
  if (!fieldErrors.wikicode) delete fieldErrors.wikicode;

  let range = null;
  if (typeof month === "string" && month.trim()) {
    range = parseMonthValue(month);
    if (!range) fieldErrors.month = "invalid";
  } else if (!fieldErrors.wikicode) {
    range = detectPageMonth(wikicode);
    if (!range) fieldErrors.month = "undetected";
  }

  if (Object.keys(fieldErrors).length > 0 || !range) return { ok: false, fieldErrors };

  const result = await getCompletedTransfersWikicode(wikicode, range);
  if (typeof result === "string") return { ok: false, fieldErrors: { wikicode: result } };
  return { ok: true, month: `${range.year}-${String(range.month).padStart(2, "0")}`, ...result };
}
