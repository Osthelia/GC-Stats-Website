/**
 * GC-Stats - roster-watch
 *
 * Scheduled job: daily pass over the followed team X accounts, see lib/roster-watch.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { classifyTweet } from "@/lib/roster-watch/classifier";
import { createDefaultProvider } from "@/lib/roster-watch/providers/twitterapi-io";
import { runRosterWatch } from "@/lib/roster-watch/run";
import { dbRosterWatchStore } from "@/lib/roster-watch/store-db";

export async function rosterWatch(): Promise<string> {
  const provider = createDefaultProvider();
  if (!provider) return "no TWITTERAPI_IO_KEY configured, roster watch skipped";
  if (!process.env.ANTHROPIC_API_KEY) return "no ANTHROPIC_API_KEY configured, roster watch skipped";

  const stats = await runRosterWatch({ store: dbRosterWatchStore, provider, classify: classifyTweet });
  console.log(
    "[roster-watch] %d account(s) (%d failed), %d API call(s), %d new tweet(s): %d excluded, %d classified, %d errors, %d retried",
    stats.accounts,
    stats.failedAccounts,
    stats.apiCalls,
    stats.tweets,
    stats.excluded,
    stats.classified,
    stats.errors,
    stats.retried,
  );
  if (stats.accounts > 0 && stats.failedAccounts === stats.accounts) throw new Error(`roster watch failed on all ${stats.accounts} account(s)`);
  return `watched ${stats.accounts} account(s), ${stats.tweets} new tweet(s)`;
}
