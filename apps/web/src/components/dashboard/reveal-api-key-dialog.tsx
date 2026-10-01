/**
 * GC-Stats - reveal-api-key-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardInfoBar } from "@/components/dashboard/dashboard-info-bar";

/** Shows a freshly generated/regenerated API key plaintext exactly once, mirrors components/admin/reveal-api-key-dialog.tsx. Shared by the org-scoped and personal API key panels. */
export function RevealApiKeyDialog({ plainKey, onClose }: { plainKey: string | null; onClose: () => void }) {
  const t = useTranslations("dashboard.apiKeys");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!plainKey) return;
    await navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={plainKey !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("revealTitle")}</DialogTitle>
          <DialogDescription>{t("revealDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">{plainKey}</div>

        <DashboardInfoBar>{t("revealWarning")}</DashboardInfoBar>

        <DialogFooter>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t("copied") : t("copy")}
          </Button>
          <Button onClick={onClose}>{t("done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
