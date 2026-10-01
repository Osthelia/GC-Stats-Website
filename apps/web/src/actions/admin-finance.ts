/**
 * GC-Stats - admin-finance
 *
 * Admin server actions for finance ledger entries (income/expense), with
 * EUR/USD conversion handled via the exchange-rate lib.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { financeEntries, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { eurToUsd } from "@/lib/exchange-rate";
import { FINANCE_CATEGORIES } from "@/lib/admin-finance";

async function requireFinanceActor(): Promise<void> {
  // Re-checked here, not just relied on from the /admin layout guard — a
  // server action is reachable as its own POST endpoint regardless of which
  // page rendered the form that calls it.
  await requireActorPermission(PERMISSIONS.financeManage);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = ["EUR", "USD"] as const;
type Currency = (typeof CURRENCIES)[number];

type CommonInput = {
  entryDate: string;
  type: "income" | "expense";
  category: string;
  customCategory: string;
  label: string;
  description: string;
  sourceUrl: string;
};

export type CreateFinanceEntryInput = CommonInput & { amount: string; currency: string };
export type UpdateFinanceEntryInput = CommonInput & { amountEur: string; amountUsd: string };

export type FinanceEntryField =
  | "entryDate"
  | "type"
  | "category"
  | "customCategory"
  | "label"
  | "description"
  | "sourceUrl"
  | "amount"
  | "currency"
  | "amountEur"
  | "amountUsd";
export type FinanceEntryFieldErrors = Partial<Record<FinanceEntryField, string>>;
export type FinanceEntryResult = { ok: true; id: number; staleRate?: boolean } | { ok: false; fieldErrors: FinanceEntryFieldErrors };

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateCommon(input: CommonInput): { fieldErrors: FinanceEntryFieldErrors; category: string } {
  const fieldErrors: FinanceEntryFieldErrors = {};

  if (!DATE_RE.test(input.entryDate)) fieldErrors.entryDate = "invalid";

  if (input.type !== "income" && input.type !== "expense") fieldErrors.type = "invalid";

  if (!(FINANCE_CATEGORIES as readonly string[]).includes(input.category)) fieldErrors.category = "invalid";
  const customCategory = input.customCategory.trim();
  if (input.category === "Other" && !customCategory) fieldErrors.customCategory = "required";
  else if (customCategory.length > 50) fieldErrors.customCategory = "tooLong";

  const label = input.label.trim();
  if (!label) fieldErrors.label = "required";
  else if (label.length < 2) fieldErrors.label = "tooShort";
  else if (label.length > 100) fieldErrors.label = "tooLong";

  const description = input.description.trim();
  if (description.length > 1000) fieldErrors.description = "tooLong";

  const sourceUrl = input.sourceUrl.trim();
  if (sourceUrl && !isValidUrl(sourceUrl)) fieldErrors.sourceUrl = "invalid";
  else if (sourceUrl.length > 255) fieldErrors.sourceUrl = "tooLong";

  return { fieldErrors, category: input.category === "Other" ? customCategory : input.category };
}

function validateAmount(value: string, field: "amount" | "amountEur" | "amountUsd"): { value: number; error?: FinanceEntryFieldErrors } {
  const num = Number(value);
  if (!value || !Number.isFinite(num) || num < 0.01 || num > 99_999_999.99) return { value: 0, error: { [field]: "invalid" } };
  return { value: num };
}

export async function createFinanceEntry(input: CreateFinanceEntryInput): Promise<FinanceEntryResult> {
  await requireFinanceActor();

  const { fieldErrors, category } = validateCommon(input);

  const currency = (CURRENCIES as readonly string[]).includes(input.currency) ? (input.currency as Currency) : null;
  if (!currency) fieldErrors.currency = "invalid";

  const amountResult = validateAmount(input.amount, "amount");
  Object.assign(fieldErrors, amountResult.error);

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const { rate: eurUsd, stale: staleRate } = await eurToUsd();
  const amountUsd = currency === "USD" ? amountResult.value : amountResult.value * eurUsd;
  const amountEur = currency === "EUR" ? amountResult.value : amountResult.value / eurUsd;

  const [created] = await db
    .insert(financeEntries)
    .values({
      entryDate: input.entryDate,
      type: input.type,
      category,
      label: input.label.trim(),
      description: input.description.trim() || null,
      sourceUrl: input.sourceUrl.trim() || null,
      amountUsd: amountUsd.toFixed(2),
      amountEur: amountEur.toFixed(2),
    })
    .returning({ id: financeEntries.id });
  if (!created) throw new Error("Insert returned no row");
  if (staleRate) console.error(`createFinanceEntry: entry ${created.id} created with a 1:1 fallback EUR/USD rate`);

  return { ok: true, id: created.id, staleRate };
}

export async function updateFinanceEntry(id: number, input: UpdateFinanceEntryInput): Promise<FinanceEntryResult> {
  await requireFinanceActor();

  const { fieldErrors, category } = validateCommon(input);

  const eurResult = validateAmount(input.amountEur, "amountEur");
  Object.assign(fieldErrors, eurResult.error);
  const usdResult = validateAmount(input.amountUsd, "amountUsd");
  Object.assign(fieldErrors, usdResult.error);

  const [existing] = await db.select({ id: financeEntries.id }).from(financeEntries).where(eq(financeEntries.id, id)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { label: "notFound" } };

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(financeEntries)
    .set({
      entryDate: input.entryDate,
      type: input.type,
      category,
      label: input.label.trim(),
      description: input.description.trim() || null,
      sourceUrl: input.sourceUrl.trim() || null,
      amountUsd: usdResult.value.toFixed(2),
      amountEur: eurResult.value.toFixed(2),
    })
    .where(eq(financeEntries.id, id));

  return { ok: true, id };
}

export type DeleteFinanceEntryResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteFinanceEntry(id: number): Promise<DeleteFinanceEntryResult> {
  await requireFinanceActor();

  const [existing] = await db.select({ id: financeEntries.id }).from(financeEntries).where(eq(financeEntries.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(financeEntries).where(eq(financeEntries.id, id));
  return { ok: true };
}
