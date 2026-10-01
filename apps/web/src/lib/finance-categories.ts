/**
 * GC-Stats - finance-categories
 *
 * Pure constants, no DB import, safe to pull into client components (see
 * lib/admin-finance.ts, which re-exports these but also imports the DB
 * client and must stay server-only).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const FINANCE_CATEGORIES = ["Donation", "Advertising", "Infrastructure", "Software & Licenses", "Other"] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];
