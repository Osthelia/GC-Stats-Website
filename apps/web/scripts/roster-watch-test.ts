/**
 * GC-Stats - roster-watch-test
 *
 * Runs the roster watch pipeline for one X handle against the real providers
 * (TwitterAPI.io and Anthropic) with an in memory store: nothing is written to the
 * database, every tweet decision is logged.
 *
 * Usage (from apps/web): npm run test:roster-watch -- <handle>
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { classifierModel, classifyTweet } from "../src/lib/roster-watch/classifier";
import { createDefaultProvider } from "../src/lib/roster-watch/providers/twitterapi-io";
import { normalizeXHandle } from "../src/lib/roster-watch/review";
import { runRosterWatch, type NewSignal, type RosterWatchStore, type WatchedAccount } from "../src/lib/roster-watch/run";

async function main() {
  const handle = normalizeXHandle(process.argv[2] ?? "");
  if (!handle.ok) {
    console.error("[roster-watch-test] usage: npm run test:roster-watch -- <handle> (%s)", handle.error);
    process.exit(1);
  }
  const provider = createDefaultProvider();
  if (!provider) {
    console.error("[roster-watch-test] TWITTERAPI_IO_KEY is not set");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[roster-watch-test] ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  console.log("[roster-watch-test] @%s, model %s, nothing is written to the database", handle.handle, classifierModel());

  const account: WatchedAccount = { id: 1, teamId: 1, teamName: handle.handle, xHandle: handle.handle, xUserId: null, lastSeenTweetId: null };
  const signals = new Map<string, NewSignal>();
  const store: RosterWatchStore = {
    listEnabledAccounts: async () => [account],
    existingTweetIds: async (ids) => new Set(ids.filter((id) => signals.has(id))),
    insertSignal: async (signal) => void signals.set(signal.tweetId, signal),
    updateAccount: async (_id, patch) => {
      if (patch.lastError) console.error("[roster-watch-test] account error: %s", patch.lastError);
    },
    listErroredSignals: async () => [],
    saveClassification: async () => {},
  };

  const stats = await runRosterWatch({ store, provider, classify: classifyTweet });
  console.log("[roster-watch-test] done: %o", stats);

  const byVerdict = new Map<string, number>();
  for (const signal of signals.values()) {
    const key = signal.classification ? signal.classification.verdict : signal.stage;
    byVerdict.set(key, (byVerdict.get(key) ?? 0) + 1);
  }
  console.log("[roster-watch-test] summary: %o", Object.fromEntries(byVerdict));
  process.exit(0);
}

main().catch((error) => {
  console.error("[roster-watch-test] failed", error);
  process.exit(1);
});
