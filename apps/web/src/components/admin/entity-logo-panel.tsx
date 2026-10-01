/**
 * GC-Stats - entity-logo-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImageOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HiddenBadge } from "@/components/admin/hidden-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { uploadEntityLogo, updateEntityLogo, deleteEntityLogo, type UploadLogoFieldErrors, type UpdateLogoFieldErrors } from "@/actions/admin-logos";
import type { AdminLogoEntry, LogoEntityType } from "@/lib/admin-logos";

const NO_THEME = "none";

/** Set right before a reload when an edit replaced the image bytes at the same URL — read once so that one image doesn't serve a stale cached copy (see s3.ts's 1h cache-control) right after being edited. */
function readAndClearCacheBust(logoId: string): number | null {
  try {
    const key = `gcs_logo_bust_${logoId}`;
    const value = sessionStorage.getItem(key);
    if (!value) return null;
    sessionStorage.removeItem(key);
    return Number(value);
  } catch {
    return null;
  }
}

/** Every logo needs a fallback (CLAUDE.md) — falls back to a neutral tile if `src` is missing or fails to load. */
function LogoImage({ src, alt, className, logoId }: { src: string | null; alt: string; className: string; logoId: string }) {
  const [failed, setFailed] = useState(false);
  const [bust] = useState(() => (logoId ? readAndClearCacheBust(logoId) : null));

  if (!src || failed) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground ${className}`}>
        <ImageOff className="size-4" />
      </div>
    );
  }

  const finalSrc = bust ? `${src}${src.includes("?") ? "&" : "?"}v=${bust}` : src;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={finalSrc} alt={alt} className={`shrink-0 rounded-md border object-contain ${className}`} onError={() => setFailed(true)} />;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Shared by team and player edit pages — same `logos` table + upload flow for both entity types, only the i18n namespace differs. */
export function EntityLogoPanel({
  namespace,
  entityType,
  entityId,
  displayName,
  entries: initialEntries,
  canEdit,
}: {
  namespace: "admin.teams.edit" | "admin.players.edit" | "admin.organizations.edit";
  entityType: LogoEntityType;
  entityId: number;
  displayName: string;
  entries: AdminLogoEntry[];
  canEdit: boolean;
}) {
  const t = useTranslations(namespace);
  const [entries, setEntries] = useState(initialEntries);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(NO_THEME);
  const [from, setFrom] = useState(todayIso);
  const [until, setUntil] = useState("");
  const [fieldErrors, setFieldErrors] = useState<UploadLogoFieldErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<AdminLogoEntry | null>(null);
  const [editTheme, setEditTheme] = useState(NO_THEME);
  const [editFrom, setEditFrom] = useState("");
  const [editUntil, setEditUntil] = useState("");
  const [editFieldErrors, setEditFieldErrors] = useState<UpdateLogoFieldErrors>({});
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const initials = displayName.trim().slice(0, 2).toUpperCase() || "?";
  const current = entries.find((e) => e.isOngoing && e.isVisible && !e.theme) ?? entries.find((e) => e.isOngoing && e.isVisible) ?? null;

  function resetForm() {
    setTheme(NO_THEME);
    setFrom(todayIso());
    setUntil("");
    setFieldErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    setFieldErrors({});

    const formData = new FormData();
    if (file) formData.set("file", file);
    formData.set("theme", theme === NO_THEME ? "" : theme);
    formData.set("from", from);
    formData.set("until", until);

    startTransition(async () => {
      const result = await uploadEntityLogo(entityType, entityId, formData);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setOpen(false);
      resetForm();
      toast.success(t("logoUploadSuccess"));
      window.location.reload();
    });
  }

  function openEdit(entry: AdminLogoEntry) {
    setEditing(entry);
    setEditTheme(entry.theme ?? NO_THEME);
    setEditFrom(entry.since ?? todayIso());
    setEditUntil(entry.until ?? "");
    setEditFieldErrors({});
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  function handleUpdate() {
    if (!editing) return;
    const file = editFileInputRef.current?.files?.[0];
    setEditFieldErrors({});

    const formData = new FormData();
    if (file) formData.set("file", file);
    formData.set("theme", editTheme === NO_THEME ? "" : editTheme);
    formData.set("from", editFrom);
    formData.set("until", editUntil);

    startTransition(async () => {
      const result = await updateEntityLogo(entityType, editing.id, formData);
      if (!result.ok) {
        setEditFieldErrors(result.fieldErrors);
        return;
      }
      if (file) {
        // Same URL, new bytes — bust the cache for this one image right after reload (see s3.ts's cache-control).
        try {
          sessionStorage.setItem(`gcs_logo_bust_${editing.id}`, String(Date.now()));
        } catch {
          // sessionStorage unavailable (private mode, etc.) — worst case the image just looks stale until the cache expires.
        }
      }
      setEditing(null);
      toast.success(t("logoEditSuccess"));
      window.location.reload();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteEntityLogo(entityType, id);
      if (!result.ok) {
        setConfirmDeleteId(null);
        toast.error(t(`logoDeleteError.${result.error}` as "logoDeleteError.notFound"));
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteId(null);
      toast.success(t("logoDeleteSuccess"));
    });
  }

  const err = (field: keyof UploadLogoFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);
  const editErr = (field: keyof UpdateLogoFieldErrors) => (editFieldErrors[field] ? t(`error.${editFieldErrors[field]}`) : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sectionLogo")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {current ? (
            <LogoImage src={current.thumbnailUrl} alt={displayName} className="size-14" logoId={current.id} />
          ) : (
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
          )}
          {!current && <p className="text-xs text-muted-foreground">{t("logoNoneYet")}</p>}
        </div>

        {canEdit && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
            {t("logoUploadButton")}
          </Button>
        )}

        {entries.length > 0 && (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <LogoImage src={entry.thumbnailUrl} alt={displayName} className="size-8" logoId={entry.id} />
                  <span>
                    {entry.since ?? "?"} → {entry.isOngoing ? "–" : (entry.until ?? "?")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {entry.theme && (
                    <Badge variant="outline" className={entry.theme === "dark" ? "border-violet-400/20 bg-violet-400/10 text-violet-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}>
                      {entry.theme}
                    </Badge>
                  )}
                  {!entry.isVisible && <HiddenBadge>{t("logoHistoryHidden")}</HiddenBadge>}
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => openEdit(entry)}>
                        {t("logoEditButton")}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setConfirmDeleteId(entry.id)}>
                        {t("logoDeleteButton")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {entries.length === 0 && <p className="text-xs text-muted-foreground">{t("logoHistoryEmpty")}</p>}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("logoUploadDialogTitle")}</DialogTitle>
            <DialogDescription>{t("logoUploadDialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <FormField label={t("logoUploadFileLabel")} htmlFor="logo-upload-file" required error={err("file")}>
              <Input id="logo-upload-file" ref={fileInputRef} type="file" accept="image/*" aria-invalid={!!fieldErrors.file} />
            </FormField>

            <FormField label={t("logoUploadThemeLabel")} htmlFor="logo-upload-theme" error={err("theme")}>
              <Select
                items={{ [NO_THEME]: t("logoUploadThemeNone"), light: t("logoUploadThemeLight"), dark: t("logoUploadThemeDark") }}
                value={theme}
                onValueChange={(v) => setTheme(v ?? NO_THEME)}
              >
                <SelectTrigger id="logo-upload-theme" aria-invalid={!!fieldErrors.theme} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_THEME}>{t("logoUploadThemeNone")}</SelectItem>
                  <SelectItem value="light">{t("logoUploadThemeLight")}</SelectItem>
                  <SelectItem value="dark">{t("logoUploadThemeDark")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("logoUploadFromLabel")} htmlFor="logo-upload-from" required error={err("from")}>
                <Input id="logo-upload-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldErrors.from} />
              </FormField>
              <FormField label={t("logoUploadUntilLabel")} htmlFor="logo-upload-until" hint={t("logoUploadUntilHint")} error={err("until")}>
                <Input id="logo-upload-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-invalid={!!fieldErrors.until} />
              </FormField>
            </div>
          </div>

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

      <Dialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("logoEditDialogTitle")}</DialogTitle>
            <DialogDescription>{t("logoEditDialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <FormField label={t("logoEditFileLabel")} htmlFor="logo-edit-file" error={editErr("file")}>
              <Input id="logo-edit-file" ref={editFileInputRef} type="file" accept="image/*" aria-invalid={!!editFieldErrors.file} />
            </FormField>

            <FormField label={t("logoUploadThemeLabel")} htmlFor="logo-edit-theme" error={editErr("theme")}>
              <Select
                items={{ [NO_THEME]: t("logoUploadThemeNone"), light: t("logoUploadThemeLight"), dark: t("logoUploadThemeDark") }}
                value={editTheme}
                onValueChange={(v) => setEditTheme(v ?? NO_THEME)}
              >
                <SelectTrigger id="logo-edit-theme" aria-invalid={!!editFieldErrors.theme} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_THEME}>{t("logoUploadThemeNone")}</SelectItem>
                  <SelectItem value="light">{t("logoUploadThemeLight")}</SelectItem>
                  <SelectItem value="dark">{t("logoUploadThemeDark")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("logoUploadFromLabel")} htmlFor="logo-edit-from" required error={editErr("from")}>
                <Input id="logo-edit-from" type="date" value={editFrom} onChange={(e) => setEditFrom(e.target.value)} aria-invalid={!!editFieldErrors.from} />
              </FormField>
              <FormField label={t("logoUploadUntilLabel")} htmlFor="logo-edit-until" hint={t("logoUploadUntilHint")} error={editErr("until")}>
                <Input id="logo-edit-until" type="date" value={editUntil} onChange={(e) => setEditUntil(e.target.value)} aria-invalid={!!editFieldErrors.until} />
              </FormField>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={isPending}>
              {t("logoUploadCancel")}
            </Button>
            <Button onClick={handleUpdate} disabled={isPending}>
              {isPending ? t("logoUploadSubmitting") : t("logoEditSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title={t("confirmTitle")}
        description={t("logoDeleteConfirm")}
        confirmLabel={t("logoDeleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
        isPending={isPending}
        destructive
      />
    </Card>
  );
}
