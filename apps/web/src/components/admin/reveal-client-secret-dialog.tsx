/**
 * GC-Stats - reveal-client-secret-dialog
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
import { AdminInfoBar } from "@/components/admin/admin-info-bar";

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
        <span className="flex-1">{value}</span>
        <button type="button" onClick={handleCopy} className="flex-none text-muted-foreground hover:text-foreground">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/** Shows a freshly created/regenerated OAuth client's id (and secret, for confidential clients) exactly once — only the secret's hash is stored, it can never be retrieved again. */
export function RevealClientSecretDialog({ reveal, onClose }: { reveal: { clientId: string; clientSecret: string | null } | null; onClose: () => void }) {
  const t = useTranslations("admin.oauthClients");

  return (
    <Dialog open={reveal !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("revealTitle")}</DialogTitle>
          <DialogDescription>{reveal?.clientSecret ? t("revealDescription") : t("revealDescriptionPublic")}</DialogDescription>
        </DialogHeader>

        {reveal && (
          <div className="flex flex-col gap-3">
            <CopyRow label={t("revealClientId")} value={reveal.clientId} />
            {reveal.clientSecret && <CopyRow label={t("revealClientSecret")} value={reveal.clientSecret} />}
          </div>
        )}

        {reveal?.clientSecret && <AdminInfoBar>{t("revealWarning")}</AdminInfoBar>}

        <DialogFooter>
          <Button onClick={onClose}>{t("done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
