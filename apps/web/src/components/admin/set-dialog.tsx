/**
 * GC-Stats - set-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { createContainerSet, renameContainerSet, type ContainerFieldErrors } from "@/actions/admin-containers";
import type { AdminContainerRow } from "@/lib/admin-tournament-detail";
import type { SetOption } from "@/components/admin/container-dialog";

const ROOT_VALUE = "root";

/** Creates a set, or renames the one given. A new set can be nested in another set. */
export function SetDialog({
  stageId,
  set: existing,
  sets = [],
  defaultParentId = null,
  open,
  onOpenChange,
}: {
  stageId: number;
  set?: AdminContainerRow | null;
  sets?: SetOption[];
  defaultParentId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<ContainerFieldErrors>({});
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(ROOT_VALUE);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setParentId(defaultParentId === null ? ROOT_VALUE : String(defaultParentId));
    setFieldErrors({});
  }, [open, existing, defaultParentId]);

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = existing
        ? await renameContainerSet(existing.id, stageId, { name })
        : await createContainerSet(stageId, { name, parentId: parentId === ROOT_VALUE ? null : Number(parentId) });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(existing ? t("setUpdateSuccess") : t("setAddSuccess"));
    });
  }

  const err = (field: keyof ContainerFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? t("setEditTitle") : t("setAddTitle")}</DialogTitle>
          <DialogDescription>{existing ? t("setEditDescription") : t("setAddDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FormField label={t("fieldContainerName")} htmlFor="set-name" required error={err("name")}>
            <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} />
          </FormField>

          {!existing && sets.length > 0 && (
            <FormField label={t("fieldParentSet")} htmlFor="set-parent" error={err("parentId")} hint={t("fieldParentSetHint")}>
              <Select items={{ [ROOT_VALUE]: t("parentSetNone"), ...Object.fromEntries(sets.map((s) => [String(s.id), s.label])) }} value={parentId} onValueChange={(v) => setParentId(String(v))}>
                <SelectTrigger id="set-parent" className="w-full" aria-invalid={!!fieldErrors.parentId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_VALUE}>{t("parentSetNone")}</SelectItem>
                  {sets.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
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
