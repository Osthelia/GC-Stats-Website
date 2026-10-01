/**
 * GC-Stats - create-group-dialog
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
import { createPickemGroup } from "@/actions/pickem";

export function CreateGroupDialog({ tournamentId, open, onOpenChange }: { tournamentId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("pickemPage.groups");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createPickemGroup(tournamentId, name);
      if (!result.ok) {
        setError(t(`createError.${result.error}`));
        return;
      }
      setName("");
      onOpenChange(false);
      router.refresh();
      toast.success(t("createSuccess", { code: result.joinCode }));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <FormField label={t("fieldName")} htmlFor="pickem-group-name" required error={error ?? undefined}>
            <Input id="pickem-group-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("creating") : t("createButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
