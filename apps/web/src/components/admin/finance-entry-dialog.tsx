/**
 * GC-Stats - finance-entry-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { createFinanceEntry, updateFinanceEntry, type FinanceEntryFieldErrors } from "@/actions/admin-finance";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import type { AdminFinanceEntry } from "@/lib/admin-finance";

type FormState = {
  entryDate: string;
  type: "income" | "expense";
  category: string;
  customCategory: string;
  label: string;
  description: string;
  sourceUrl: string;
  amount: string;
  currency: "EUR" | "USD";
  amountEur: string;
  amountUsd: string;
};

function emptyState(): FormState {
  return {
    entryDate: new Date().toISOString().slice(0, 10),
    type: "income",
    category: FINANCE_CATEGORIES[0],
    customCategory: "",
    label: "",
    description: "",
    sourceUrl: "",
    amount: "",
    currency: "USD",
    amountEur: "",
    amountUsd: "",
  };
}

function stateFromEntry(entry: AdminFinanceEntry): FormState {
  const known = (FINANCE_CATEGORIES as readonly string[]).includes(entry.category);
  return {
    entryDate: entry.entryDate.slice(0, 10),
    type: entry.type,
    category: known ? entry.category : "Other",
    customCategory: known ? "" : entry.category,
    label: entry.label,
    description: entry.description ?? "",
    sourceUrl: entry.sourceUrl ?? "",
    amount: "",
    currency: "USD",
    amountEur: entry.amountEur,
    amountUsd: entry.amountUsd,
  };
}

/**
 * Create (entry=null) and edit (entry=row) share this dialog. Create asks for
 * a single amount+currency (converted server-side via the live EUR/USD
 * rate); edit shows both stored amounts directly for correction, mirroring
 * V1's admin FinanceController (store() converts, update() takes both).
 */
export function FinanceEntryDialog({ entry, open, onOpenChange }: { entry: AdminFinanceEntry | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.finance");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FinanceEntryFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(entry ? stateFromEntry(entry) : emptyState());
      setFieldErrors({});
    }
  }, [open, entry]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const common = {
        entryDate: form.entryDate,
        type: form.type,
        category: form.category,
        customCategory: form.customCategory,
        label: form.label,
        description: form.description,
        sourceUrl: form.sourceUrl,
      };

      const result = entry
        ? await updateFinanceEntry(entry.id, { ...common, amountEur: form.amountEur, amountUsd: form.amountUsd })
        : await createFinanceEntry({ ...common, amount: form.amount, currency: form.currency });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(entry ? t("edit.updateSuccess") : t("create.success"));
      if (result.staleRate) toast.warning(t("create.staleRate"));
    });
  }

  const err = (field: keyof FinanceEntryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  const categoryItems = Object.fromEntries(FINANCE_CATEGORIES.map((c) => [c, t(`category.${c}`)]));
  const typeItems = { income: t("typeIncome"), expense: t("typeExpense") };
  const currencyItems = { EUR: "EUR", USD: "USD" };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? t("edit.title") : t("create.title")}</DialogTitle>
          <DialogDescription>{entry ? t("edit.description") : t("create.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldDate")} htmlFor="fe-date" required error={err("entryDate")}>
              <Input id="fe-date" type="date" value={form.entryDate} onChange={(e) => set("entryDate", e.target.value)} aria-invalid={!!fieldErrors.entryDate} />
            </FormField>

            <FormField label={t("fieldType")} htmlFor="fe-type" required>
              <Select items={typeItems} value={form.type} onValueChange={(v) => set("type", v as FormState["type"])}>
                <SelectTrigger id="fe-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t("typeIncome")}</SelectItem>
                  <SelectItem value="expense">{t("typeExpense")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label={t("fieldLabel")} htmlFor="fe-label" required error={err("label")}>
            <Input id="fe-label" value={form.label} onChange={(e) => set("label", e.target.value)} aria-invalid={!!fieldErrors.label} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldCategory")} htmlFor="fe-category" required error={err("category")}>
              <Select items={categoryItems} value={form.category} onValueChange={(v) => set("category", v ?? "")}>
                <SelectTrigger id="fe-category" className="w-full" aria-invalid={!!fieldErrors.category}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`category.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {form.category === "Other" && (
              <FormField label={t("fieldCustomCategory")} htmlFor="fe-custom-category" required error={err("customCategory")}>
                <Input id="fe-custom-category" value={form.customCategory} onChange={(e) => set("customCategory", e.target.value)} aria-invalid={!!fieldErrors.customCategory} />
              </FormField>
            )}
          </div>

          {entry ? (
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("fieldAmountEur")} htmlFor="fe-amount-eur" required error={err("amountEur")}>
                <Input id="fe-amount-eur" type="number" step="0.01" min="0.01" value={form.amountEur} onChange={(e) => set("amountEur", e.target.value)} aria-invalid={!!fieldErrors.amountEur} />
              </FormField>
              <FormField label={t("fieldAmountUsd")} htmlFor="fe-amount-usd" required error={err("amountUsd")}>
                <Input id="fe-amount-usd" type="number" step="0.01" min="0.01" value={form.amountUsd} onChange={(e) => set("amountUsd", e.target.value)} aria-invalid={!!fieldErrors.amountUsd} />
              </FormField>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("fieldAmount")} htmlFor="fe-amount" required error={err("amount")}>
                <Input id="fe-amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} aria-invalid={!!fieldErrors.amount} />
              </FormField>
              <FormField label={t("fieldCurrency")} htmlFor="fe-currency" required error={err("currency")}>
                <Select items={currencyItems} value={form.currency} onValueChange={(v) => set("currency", v as FormState["currency"])}>
                  <SelectTrigger id="fe-currency" className="w-full" aria-invalid={!!fieldErrors.currency}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}

          <FormField label={t("fieldDescription")} htmlFor="fe-description" error={err("description")}>
            <Textarea id="fe-description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!fieldErrors.description} />
          </FormField>

          <FormField label={t("fieldSourceUrl")} htmlFor="fe-source-url" error={err("sourceUrl")} hint={t("fieldSourceUrlHint")}>
            <Input id="fe-source-url" type="url" value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} aria-invalid={!!fieldErrors.sourceUrl} />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
