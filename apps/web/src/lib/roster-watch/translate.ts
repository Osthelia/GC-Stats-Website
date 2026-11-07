/**
 * GC-Stats - translate
 *
 * English translation of a tweet with the DeepL Free API. Never throws, a missing
 * translation only means the original text is shown.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const API_URL = "https://api-free.deepl.com/v2/translate";
const TIMEOUT_MS = 15_000;
const MAX_LENGTH = 2000;

export type TranslateFn = (text: string) => Promise<string | null>;

type DeepLResponse = { translations?: { detected_source_language?: string; text?: string }[] };

/** Null when there is nothing to translate, the text is already English, no key is set or DeepL fails. */
export const translateToEnglish: TranslateFn = async (text) => {
  const apiKey = process.env.DEEPL_API_KEY;
  const source = text.trim();
  if (!apiKey || !source) return null;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ text: [source], target_lang: "EN-US" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("[roster-watch] DeepL responded %d", response.status);
      return null;
    }
    const translation = ((await response.json()) as DeepLResponse).translations?.[0];
    if (!translation?.text || translation.detected_source_language?.toUpperCase().startsWith("EN")) return null;
    return translation.text.trim().slice(0, MAX_LENGTH) || null;
  } catch (error) {
    console.error("[roster-watch] DeepL request failed", error);
    return null;
  }
};
