/**
 * GC-Stats - join-group-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { joinPickemGroupByCode } from "@/actions/pickem";

export function JoinGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("pickemPage.groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await joinPickemGroupByCode(code);
      if (!result.ok) {
        setError(t(`joinError.${result.error}`));
        return;
      }
      setCode("");
      onOpenChange(false);
      router.refresh();
      toast.success(t("joinSuccess"));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("joinTitle")}</DialogTitle>
          <DialogDescription>{t("joinDescription")}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <FormField label={t("fieldCode")} htmlFor="pickem-join-code" required error={error ?? undefined}>
            <Input id="pickem-join-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-invalid={!!error} className="font-mono tracking-widest uppercase" />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("joining") : t("joinButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
