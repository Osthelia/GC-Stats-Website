/**
 * GC-Stats - create-finance-entry-button
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FinanceEntryDialog } from "@/components/admin/finance-entry-dialog";

export function CreateFinanceEntryButton() {
  const t = useTranslations("admin.finance");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("create.button")}</Button>
      <FinanceEntryDialog entry={null} open={open} onOpenChange={setOpen} />
    </>
  );
}
