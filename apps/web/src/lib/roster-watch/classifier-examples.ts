/**
 * GC-Stats - classifier-examples
 *
 * Extension point for few shot examples taken from reviewed tweets (disabled for now).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type ClassifierExample = { text: string; verdict: "roster" | "not_roster" | "unsure"; topic: string };

/** Few shot examples appended to the prompt. Stays empty until reviewed signals (team_edited / marked_not_roster) are curated into it. */
export function getClassifierExamples(): ClassifierExample[] {
  return [];
}
