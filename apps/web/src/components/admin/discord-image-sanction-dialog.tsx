/**
 * GC-Stats - discord-image-sanction-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { RequiredMark } from "@/components/admin/required-mark";
import { sanctionDiscordImage, type DiscordImageSanctionFieldErrors } from "@/actions/admin-discord-images";
import { DISCORD_IMAGE_SANCTION_REASON_MAX } from "@/lib/discord-bot/shared";
import type { AdminDiscordImageRow } from "@/lib/admin-discord-image-reviews";

type FormState = { blacklistGuild: boolean; blacklistUser: boolean; resetImage: boolean; editMessages: boolean; reason: string };

const EMPTY: FormState = { blacklistGuild: false, blacklistUser: false, resetImage: true, editMessages: true, reason: "" };

export function DiscordImageSanctionDialog({ row, open, onOpenChange }: { row: AdminDiscordImageRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.moderation.images.sanction");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<DiscordImageSanctionFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setFieldErrors({});
      setFormError(null);
    }
  }, [open, row?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    if (!row) return;
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await sanctionDiscordImage(row.id, form);
      if (!result.ok) {
        if (result.error === "notFound") setFormError(t("error.notFound"));
        else setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(result.queued > 0 ? t("successQueued", { count: result.queued }) : t("success"));
    });
  }

  const options: { key: "blacklistGuild" | "blacklistUser" | "resetImage" | "editMessages"; disabled: boolean }[] = [
    { key: "blacklistGuild", disabled: !!row?.guildBlacklisted },
    { key: "blacklistUser", disabled: !row?.editorDiscordId || !!row.userBlacklisted },
    { key: "resetImage", disabled: false },
    { key: "editMessages", disabled: false },
  ];
  const reasonError = fieldErrors.reason ? t(`error.reason.${fieldErrors.reason}`, { max: DISCORD_IMAGE_SANCTION_REASON_MAX }) : undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {t("sanctionsLabel")}
              <RequiredMark />
            </p>
            {options.map(({ key, disabled }) => (
              <div key={key} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox id={`dis-${key}`} checked={form[key]} disabled={disabled || isPending} onCheckedChange={(checked) => set(key, checked === true)} aria-invalid={!!fieldErrors.sanctions} />
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor={`dis-${key}`} className="cursor-pointer">
                    {t(`option.${key}.label`)}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t(`option.${key}.hint`)}</p>
                  {disabled && (key === "blacklistGuild" || key === "blacklistUser") && (
                    <p className="text-xs text-amber-400">{key === "blacklistUser" && !row?.editorDiscordId ? t("error.blacklistUser.noEditor") : t("alreadyBlacklisted")}</p>
                  )}
                </div>
              </div>
            ))}
            {fieldErrors.sanctions && (
              <p role="alert" className="text-xs text-destructive">
                {t("error.sanctions.required")}
              </p>
            )}
            {fieldErrors.blacklistUser && (
              <p role="alert" className="text-xs text-destructive">
                {t("error.blacklistUser.noEditor")}
              </p>
            )}
          </div>

          <FormField label={t("reasonLabel")} htmlFor="dis-reason" required error={reasonError} hint={t("reasonHint")}>
            <Textarea id="dis-reason" rows={3} value={form.reason} maxLength={DISCORD_IMAGE_SANCTION_REASON_MAX} onChange={(e) => set("reason", e.target.value)} aria-invalid={!!fieldErrors.reason} disabled={isPending} />
          </FormField>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
