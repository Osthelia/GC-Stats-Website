/**
 * GC-Stats - emote-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { TeamPicker } from "@/components/admin/team-picker";
import { AboutProjectLogo } from "@/components/admin/about-project-logo";
import { copyTeamLogoToEmote, createEmote, updateEmote, uploadEmoteImage, type EmoteFieldErrors } from "@/actions/admin-emotes";
import type { AdminEmoteRow } from "@/lib/admin-emotes";

type FormState = { name: string; imagePath: string; source: string; isActive: boolean };

function emptyState(): FormState {
  return { name: "", imagePath: "", source: "custom", isActive: true };
}

function stateFromEmote(emote: AdminEmoteRow): FormState {
  return { name: emote.name, imagePath: emote.imagePath, source: emote.source, isActive: emote.isActive };
}

export function EmoteDialog({
  emote,
  open,
  onOpenChange,
  existingSources,
}: {
  emote: AdminEmoteRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Distinct sources already in DB (e.g. "twemoji", "teams") — shown as a hint, not a closed list: `source` is free text, see lib/emote-sources.ts. */
  existingSources: string[];
}) {
  const t = useTranslations("admin.emotes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const [isCopyingTeam, startCopyTeam] = useTransition();
  const [team, setTeam] = useState<{ id: number; name: string } | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EmoteFieldErrors>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyState());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(emote ? stateFromEmote(emote) : emptyState());
      setFieldErrors({});
      setUploadError(null);
      setTeam(null);
      setTeamError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, emote]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleFileUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploadError(null);

    const formData = new FormData();
    formData.set("file", file);

    startUpload(async () => {
      const result = await uploadEmoteImage(formData);
      if (!result.ok) {
        setUploadError(t(`error.${result.error}`));
        return;
      }
      set("imagePath", result.url);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(t("uploadSuccess"));
    });
  }

  function handleTeamSelect(picked: { id: number; name: string } | null) {
    setTeam(picked);
    setTeamError(null);
    if (!picked) return;

    startCopyTeam(async () => {
      const result = await copyTeamLogoToEmote(picked.id);
      if (!result.ok) {
        setTeam(null);
        setTeamError(t(`error.${result.error}`));
        return;
      }
      setForm((prev) => ({ ...prev, imagePath: result.url, source: "teams", name: prev.name.trim() ? prev.name : result.teamName }));
      toast.success(t("teamLogoCopied"));
    });
  }

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = emote ? await updateEmote(emote.id, form) : await createEmote(form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(emote ? t("updateSuccess") : t("createSuccess"));
    });
  }

  const err = (field: keyof EmoteFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);
  const sourceHint = existingSources.length > 0 ? t("fieldSourceHint", { sources: existingSources.join(", ") }) : undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{emote ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{emote ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3">
            <AboutProjectLogo src={form.imagePath || null} alt={form.name} />
            <FormField label={t("fieldImagePath")} htmlFor="emote-image-path" required error={err("imagePath")} className="flex-1">
              <Input id="emote-image-path" type="url" value={form.imagePath} onChange={(e) => set("imagePath", e.target.value)} aria-invalid={!!fieldErrors.imagePath} />
            </FormField>
          </div>

          <FormField label={t("fieldUpload")} htmlFor="emote-upload-file" hint={t("fieldUploadHint")} error={uploadError ?? undefined}>
            <div className="flex items-center gap-2">
              <Input id="emote-upload-file" ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-invalid={!!uploadError} className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={handleFileUpload} disabled={isUploading}>
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : t("uploadButton")}
              </Button>
            </div>
          </FormField>

          {!emote && (
            <FormField label={t("fieldTeam")} htmlFor="emote-team" hint={t("fieldTeamHint")} error={teamError ?? undefined}>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <TeamPicker id="emote-team" value={team} onChange={handleTeamSelect} placeholder={t("fieldTeamPlaceholder")} searchPlaceholder={t("fieldTeamSearchPlaceholder")} noResultsLabel={t("fieldTeamNoResults")} />
                </div>
                {isCopyingTeam && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>
            </FormField>
          )}

          <FormField label={t("fieldName")} htmlFor="emote-name" required error={err("name")}>
            <Input id="emote-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} />
          </FormField>

          <div className="grid grid-cols-2 items-end gap-4">
            <FormField label={t("fieldSource")} htmlFor="emote-source" required error={err("source")} hint={sourceHint}>
              <Input id="emote-source" value={form.source} onChange={(e) => set("source", e.target.value)} aria-invalid={!!fieldErrors.source} />
            </FormField>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked === true)} />
              {t("fieldIsActive")}
            </label>
          </div>
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
