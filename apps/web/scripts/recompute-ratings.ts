/**
 * GC-Stats - recompute-ratings
 *
 * Rebuilds the GCS rating model (win probability table, baselines,
 * calibration) from every map with RAW data, stores it as the new active
 * model and rewrites the rating of every map player row.
 *
 * Usage (from apps/web): npm run ratings:recompute [-- --dry-run]
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { recomputeAllRatings } from "../src/lib/rating/recompute";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const report = await recomputeAllRatings({ dryRun: DRY_RUN, log: (line) => console.log("%s", line) });
  console.log("%s", JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("[ratings] recompute failed", error);
  process.exit(1);
});
