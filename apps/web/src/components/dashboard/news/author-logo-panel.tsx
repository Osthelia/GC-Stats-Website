/**
 * GC-Stats - author-logo-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import { uploadMyAuthorLogo, deleteMyAuthorLogo } from "@/actions/dashboard-author";

/** Mirrors DashboardLogoPanel (organization logo), same one-current-image simplicity, just for the personal byline photo. */
export function AuthorLogoPanel({
  displayName,
  logoId: initialLogoId,
  logoUrl: initialLogoUrl,
  canEdit,
}: {
  displayName: string;
  logoId: string | null;
  logoUrl: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations("dashboard.author");
  const router = useRouter();
  const [logoId, setLogoId] = useState(initialLogoId);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    setError(null);
    if (!file) {
      setError("empty");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadMyAuthorLogo(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(t("logoUploadSuccess"));
      router.refresh();
    });
  }

  function handleRemove() {
    if (!logoId) return;
    startTransition(async () => {
      const result = await deleteMyAuthorLogo(logoId);
      setConfirmRemove(false);
      if (!result.ok) {
        toast.error(t("logoDeleteError"));
        return;
      }
      setLogoId(null);
      setLogoUrl(null);
      toast.success(t("logoDeleteSuccess"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("logoTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <OrgLogoTile name={displayName} logoUrl={logoUrl} className="size-14 text-lg" />
          {!logoUrl && <p className="text-xs text-muted-foreground">{t("logoNoneYet")}</p>}
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              {logoUrl ? t("logoReplaceButton") : t("logoUploadButton")}
            </Button>
            {logoUrl && (
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setConfirmRemove(true)} className="text-destructive hover:text-destructive">
                {t("logoDeleteButton")}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setError(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{logoUrl ? t("logoReplaceButton") : t("logoUploadButton")}</DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>

          <FormField label={t("logoUploadFileLabel")} htmlFor="author-logo-file" required error={error ? t(`error.${error}` as "error.empty") : undefined}>
            <Input id="author-logo-file" ref={fileInputRef} type="file" accept="image/*" aria-invalid={!!error} />
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button onClick={handleUpload} disabled={isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("confirmTitle")}
        description={t("logoDeleteConfirm")}
        confirmLabel={t("logoDeleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleRemove}
        isPending={isPending}
        destructive
      />
    </Card>
  );
}
