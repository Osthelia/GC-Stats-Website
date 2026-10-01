/**
 * GC-Stats - finance-ledger
 *
 * Public finance ledger query, shared by the /finance page and the
 * /api/finance JSON feed so both stay in sync from one source.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db } from "@gc-stats/db/client";
import { financeEntries } from "@gc-stats/db";

export type PublicFinanceEntry = {
  id: number;
  entryDate: string;
  type: string;
  category: string;
  label: string;
  description: string | null;
  amountUsd: string;
  amountEur: string;
  sourceUrl: string | null;
};

/** Full public ledger, shared by the /finance page and the /api/finance JSON feed — kept as one query so both stay in sync. */
export async function getPublicFinanceEntries(): Promise<PublicFinanceEntry[]> {
  const rows = await db.select().from(financeEntries).orderBy(financeEntries.entryDate);
  return rows as PublicFinanceEntry[];
}
