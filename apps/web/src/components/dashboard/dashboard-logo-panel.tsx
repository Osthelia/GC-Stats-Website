/**
 * GC-Stats - dashboard-logo-panel
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/admin/form-field";
import { OrgLogoTile } from "@/components/dashboard/org-logo";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { uploadDashboardOrganizationLogo, deleteDashboardOrganizationLogo } from "@/actions/dashboard-organizations";
import type { AdminLogoEntry } from "@/lib/admin-logos";

const NO_THEME = "__none__";

/**
 * Deliberately simpler than the admin EntityLogoPanel (no dated history,
 * always the current logo for a given theme), an organization's own team
 * just needs to set or replace its light/dark logo. Full history management
 * stays /admin-only.
 */
export function DashboardLogoPanel({ organizationId, displayName, entries: initialEntries, canEdit }: { organizationId: number; displayName: string; entries: AdminLogoEntry[]; canEdit: boolean }) {
  const t = useTranslations("dashboard.profile");
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(NO_THEME);
  const [error, setError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<AdminLogoEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mirrors EntityLogoPanel's inline selection (not the currentLogo() helper from lib/admin-logos,
  // which also imports the db client: importing it here would pull server-only code into this client bundle).
  const neutral = entries.find((e) => e.isOngoing && e.isVisible && !e.theme) ?? null;
  const lightEntry = entries.find((e) => e.isOngoing && e.isVisible && e.theme === "light") ?? null;
  const darkEntry = entries.find((e) => e.isOngoing && e.isVisible && e.theme === "dark") ?? null;
  const light = lightEntry ?? neutral;
  const dark = darkEntry ?? neutral;
  const hasAny = light !== null || dark !== null;

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    setError(null);
    if (!file) {
      setError("required");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("theme", theme === NO_THEME ? "" : theme);

    startTransition(async () => {
      const result = await uploadDashboardOrganizationLogo(organizationId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setTheme(NO_THEME);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(t("logoUploadSuccess"));
      router.refresh();
    });
  }

  function confirmRemove() {
    const entry = removeConfirm;
    if (!entry) return;
    setRemoveConfirm(null);
    startTransition(async () => {
      const result = await deleteDashboardOrganizationLogo(organizationId, entry.id);
      if (!result.ok) {
        toast.error(t("logoDeleteError"));
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success(t("logoDeleteSuccess"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("logoTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-5">
          <div className="flex items-center gap-3">
            <OrgLogoTile name={displayName} logoUrl={light?.thumbnailUrl ?? null} className="size-14 rounded-lg border bg-white text-lg" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{t("logoLightLabel")}</span>
              {canEdit && lightEntry && (
                <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setRemoveConfirm(lightEntry)} className="h-auto justify-start p-0 text-xs text-destructive hover:text-destructive">
                  {t("logoDeleteButton")}
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <OrgLogoTile name={displayName} logoUrl={dark?.thumbnailUrl ?? null} className="size-14 rounded-lg border bg-neutral-900 text-lg" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{t("logoDarkLabel")}</span>
              {canEdit && darkEntry && (
                <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setRemoveConfirm(darkEntry)} className="h-auto justify-start p-0 text-xs text-destructive hover:text-destructive">
                  {t("logoDeleteButton")}
                </Button>
              )}
            </div>
          </div>
        </div>
        {!hasAny && <p className="text-xs text-muted-foreground">{t("logoNoneYet")}</p>}

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              {hasAny ? t("logoReplaceButton") : t("logoUploadButton")}
            </Button>
            {neutral && !lightEntry && !darkEntry && (
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setRemoveConfirm(neutral)} className="text-destructive hover:text-destructive">
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
            setTheme(NO_THEME);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("logoUploadDialogTitle")}</DialogTitle>
            <DialogDescription>{t("logoUploadDialogDescription")}</DialogDescription>
          </DialogHeader>

          <FormField label={t("logoUploadFileLabel")} htmlFor="dashboard-logo-file" required error={error ? t(`error.${error}` as "error.required") : undefined}>
            <Input id="dashboard-logo-file" ref={fileInputRef} type="file" accept="image/*" aria-invalid={!!error} />
          </FormField>

          <FormField label={t("logoUploadThemeLabel")} htmlFor="dashboard-logo-theme">
            <Select
              items={{ [NO_THEME]: t("logoUploadThemeNone"), light: t("logoUploadThemeLight"), dark: t("logoUploadThemeDark") }}
              value={theme}
              onValueChange={(v) => v && setTheme(v)}
            >
              <SelectTrigger id="dashboard-logo-theme" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_THEME}>{t("logoUploadThemeNone")}</SelectItem>
                <SelectItem value="light">{t("logoUploadThemeLight")}</SelectItem>
                <SelectItem value="dark">{t("logoUploadThemeDark")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("logoUploadCancel")}
            </Button>
            <Button onClick={handleUpload} disabled={isPending}>
              {isPending ? t("logoUploadSubmitting") : t("logoUploadSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeConfirm !== null}
        onOpenChange={(next) => {
          if (!next) setRemoveConfirm(null);
        }}
        title={t("logoDeleteButton")}
        description={t("logoDeleteConfirm")}
        confirmLabel={t("logoDeleteButton")}
        cancelLabel={t("logoUploadCancel")}
        onConfirm={confirmRemove}
        isPending={isPending}
      />
    </Card>
  );
}
